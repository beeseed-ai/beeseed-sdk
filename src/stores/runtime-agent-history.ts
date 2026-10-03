import type { AgentLoopEventItem, AgentLoopState, AgentLoopToolCall, Message } from '../core/types.js'

export interface RuntimeRunSummary {
  run_id: string
  channel_id: string
  agent_id: string
  agent_session_id?: string
  status: string
  queued_at?: string
  created_at: string
  started_at?: string
  completed_at?: string
  failure_detail?: string
  output_text?: string
}

export interface RuntimeRunEvent {
  run_id: string
  runtime_epoch: number
  seq: number
  event_type: string
  created_at?: string
  payload: {
    method?: string
    params?: { update?: Record<string, unknown>; status?: { phase?: string; state?: string } }
    runtime_type?: string
    event?: Record<string, unknown>
  }
}

export interface RuntimeRunDetails {
  run: RuntimeRunSummary
  events: RuntimeRunEvent[]
}

export function runtimeHistoryMessages(messages: Message[]): Message[] {
  return messages.filter(message => message.sender_type === 'agent'
    && ['reasonix_runtime', 'agent_runtime'].includes(String(message.metadata?.source))
    && typeof message.metadata?.run_id === 'string' && message.metadata.run_id.length > 0)
}

function runtimeStatus(status: string): AgentLoopState['status'] {
  if (status === 'completed') return 'completed'
  if (status === 'canceled') return 'stopped'
  if (['failed', 'timed_out', 'fenced', 'budget_exhausted', 'loop_blocked'].includes(status)) return 'error'
  if (status === 'waiting_user') return 'waiting_for_user'
  return 'running'
}

export function runtimeRunNeedsRefreshRecovery(run: RuntimeRunSummary): boolean {
  return run.status !== 'completed'
}

export function runtimeRunLoop(run: RuntimeRunSummary, finalContent?: string, previous?: AgentLoopState): AgentLoopState {
  // The user-visible total starts when the request entered the queue. Using
  // started_at here hid the entire platform preparation delay from the card.
  const startedAt = Date.parse(run.queued_at || run.created_at)
  let completedAt = run.completed_at ? Date.parse(run.completed_at) : undefined
  let status = runtimeStatus(run.status)
  if (previous && !['running', 'waiting_for_user'].includes(previous.status)
    && ['running', 'waiting_for_user'].includes(status)) {
    status = previous.status
    completedAt = previous.completedAt
  }
  const terminal = !['running', 'waiting_for_user'].includes(status)
  return {
    ...previous,
    runId: run.run_id, channelId: run.channel_id, agentId: run.agent_id, historySource: 'runtime',
    startedAt, completedAt, status, currentTurn: 1,
    finalContent: finalContent ?? run.output_text ?? previous?.finalContent,
    error: status === 'error' || status === 'stopped' ? run.failure_detail : undefined,
    turns: [{
      ...previous?.turns[0], turnNumber: 1, startedAt, completedAt,
      status: terminal ? 'completed' : 'active',
      toolCalls: previous?.turns[0]?.toolCalls ?? [], skillUses: previous?.turns[0]?.skillUses ?? [],
    }],
  }
}

function textContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textContent).filter(Boolean).join('\n')
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.type === 'text' && typeof record.text === 'string') return record.text
    if (record.content) return textContent(record.content)
  }
  return ''
}

export function runtimeRunTranscript(details: RuntimeRunDetails, finalContent?: string, previous?: AgentLoopState): AgentLoopState {
  const loop = runtimeRunLoop(details.run, finalContent, previous)
  const events: AgentLoopEventItem[] = []
  const tools = new Map<string, AgentLoopToolCall>()
  const seen = new Set<string>()
  const ordered = [...details.events].sort((a, b) => a.runtime_epoch - b.runtime_epoch || a.seq - b.seq)
  for (const event of ordered) {
    if (event.run_id !== details.run.run_id || !['reasonix.acp', 'cloudflare.think'].includes(event.event_type)) continue
    const id = `${event.run_id}:${event.runtime_epoch}:${event.seq}`
    if (seen.has(id)) continue
    seen.add(id)
    const timestamp = event.created_at ? Date.parse(event.created_at) : loop.startedAt
    const base = { id, seq: event.seq, turnNumber: 1, timestamp }
    const envelope = event.payload
    if (event.event_type === 'cloudflare.think') {
      const update = envelope.event
      if (envelope.runtime_type === 'chunk' && update?.type === 'text-delta' && typeof update.delta === 'string') {
        const last = events.at(-1)
        if (last?.type === 'assistant_content') last.content = (last.content || '') + update.delta
        else events.push({ ...base, type: 'assistant_content', content: update.delta })
      } else if (envelope.runtime_type === 'tool' && update) {
        if (update.phase === 'progress' && update.name === 'agent_step') {
          const stage = typeof update.stage === 'string' ? update.stage.trim() : ''
          const step = typeof update.step === 'number' ? `第 ${update.step} 步` : ''
          const summary = [stage, step].filter(Boolean).join(' · ') || 'Agent 正在处理…'
          if (events.at(-1)?.summary !== summary) events.push({ ...base, type: 'progress', summary })
          continue
        }
        const callId = typeof update.callId === 'string' ? update.callId : ''
        const name = typeof update.name === 'string' ? update.name : callId
        if (!callId || !name) continue
        const key = `${event.runtime_epoch}:${callId}`
        const prior = tools.get(key)
        if (update.phase === 'started') {
          const tool: AgentLoopToolCall = {
            id: `${event.run_id}:${key}`, toolCallId: callId, seq: event.seq, name,
            status: 'calling', startedAt: timestamp,
          }
          tools.set(key, tool)
          events.push({ ...base, type: 'tool_call', tool })
        } else if (update.phase === 'completed') {
          const tool: AgentLoopToolCall = {
            ...prior, id: prior?.id || `${event.run_id}:${key}`, toolCallId: callId, seq: event.seq, name,
            status: update.success === true ? 'success' : 'failed',
            startedAt: prior?.startedAt ?? timestamp, completedAt: timestamp,
          }
          tools.set(key, tool)
          events.push({ ...base, type: 'tool_result', tool })
        }
      }
      continue
    }
    if (envelope.method === 'session/update') {
      const update = envelope.params?.update
      if (!update) continue
      const kind = update.sessionUpdate
      if (kind === 'agent_message_chunk') {
        const content = textContent(update.content)
        if (!content) continue
        const last = events.at(-1)
        if (last?.type === 'assistant_content') last.content = (last.content || '') + content
        else events.push({ ...base, type: 'assistant_content', content })
      } else if (kind === 'tool_call' || kind === 'tool_call_update') {
        const callId = String(update.toolCallId || '')
        if (!callId) continue
        const key = `${event.runtime_epoch}:${callId}`
        const prior = tools.get(key)
        const name = String(update.title || prior?.name || callId)
        if (kind === 'tool_call') {
          const args = update.rawInput && typeof update.rawInput === 'object' && !Array.isArray(update.rawInput)
            ? update.rawInput as Record<string, unknown> : undefined
          const tool: AgentLoopToolCall = { id: `${event.run_id}:${key}`, toolCallId: callId, seq: event.seq, name, args, status: 'calling', startedAt: timestamp }
          tools.set(key, tool)
          events.push({ ...base, type: 'tool_call', tool })
        } else {
          const status = String(update.status || '').toLowerCase()
          if (!['completed', 'complete', 'success', 'succeeded', 'failed', 'error'].includes(status)) continue
          const tool: AgentLoopToolCall = {
            ...prior, id: prior?.id || `${event.run_id}:${key}`, toolCallId: callId, seq: event.seq, name,
            status: status === 'failed' || status === 'error' ? 'failed' : 'success',
            startedAt: prior?.startedAt ?? timestamp, completedAt: timestamp,
            output: textContent(update.rawOutput) || textContent(update.content),
          }
          tools.set(key, tool)
          events.push({ ...base, type: 'tool_result', tool })
        }
      } else if (kind === 'agent_thought_chunk' || kind === 'thought_chunk') {
        if (events.at(-1)?.summary !== 'Agent 正在思考…') events.push({ ...base, type: 'progress', summary: 'Agent 正在思考…' })
      }
    } else if (envelope.method === '_reasonix.io/session/status_update') {
      const status = envelope.params?.status
      const summary = [status?.phase, status?.state].filter(Boolean).join(' · ')
      if (summary && events.at(-1)?.summary !== summary) events.push({ ...base, type: 'progress', summary })
    }
  }
  loop.events = events
  loop.turns[0].toolCalls = [...tools.values()]
  return loop
}
