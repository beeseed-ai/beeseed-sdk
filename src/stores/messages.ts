import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type {
  Message, ChatMessage, StreamState, WSEvent,
  ChannelMemberInfo, AgentLoopState, AgentLoopTurn, AgentLoopToolCall, AgentLoopSkillUse,
  AgentLoopEventItem, AgentTodoItem, AskUserData, AskUserQuestion, SelectedSkillIntent,
} from '../core/types.js'

const AGENT_LOOP_STALE_AFTER_MS = 30 * 60 * 1000
const AGENT_LOOP_STALE_MESSAGE = '长时间没有收到 Agent 进度，任务可能已中断。'

// ── Message parsing (wire Message → display ChatMessage) ──

function isPersistedAgentLoopEvent(m: Message): boolean {
  const meta = (m.metadata ?? {}) as Record<string, unknown>
  return meta.source === 'agent_loop'
}

function getAskUserStatus(meta: Record<string, unknown>): 'pending' | 'answered' | 'expired' {
  if (meta.ask_user_status === 'answered') return 'answered'
  if (meta.ask_user_status === 'expired') return 'expired'
  const expiresAt = typeof meta.expires_at === 'string' ? Date.parse(meta.expires_at) : NaN
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return 'expired'
  return 'pending'
}

function parseSkillEnableRequest(meta: Record<string, unknown>): AskUserData['skillEnableRequest'] | undefined {
  const raw = meta.skill_enable_request
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const data = raw as Record<string, unknown>
  return {
    skill: typeof data.skill === 'string' ? data.skill : undefined,
    displayName: typeof data.display_name === 'string' ? data.display_name : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    agentId: typeof data.agent_id === 'string' ? data.agent_id : undefined,
    agentName: typeof data.agent_name === 'string' ? data.agent_name : undefined,
  }
}

function metadataRunId(meta: Record<string, unknown>): string | undefined {
	return typeof meta.run_id === 'string' && meta.run_id.trim() !== ''
		? meta.run_id
		: undefined
}

function workflowTargetFromMetadata(meta: Record<string, unknown>): ChatMessage['workflowTarget'] | undefined {
	if (meta.source !== 'workflow') return undefined
	const runId = typeof meta.workflow_run_id === 'string' ? meta.workflow_run_id.trim() : ''
	if (!runId) return undefined
	const workflowId = typeof meta.workflow_id === 'string' ? meta.workflow_id.trim() : ''
	const nodeRunId = typeof meta.workflow_node_run_id === 'string' ? meta.workflow_node_run_id.trim() : ''
	const event = typeof meta.event === 'string' ? meta.event.trim() : ''
	return {
		runId,
		workflowId: workflowId || undefined,
		nodeRunId: nodeRunId || undefined,
		event: event || undefined,
	}
}

function parseSelectedSkills(meta: Record<string, unknown>): SelectedSkillIntent[] | undefined {
  const raw = meta.selected_skills
  if (!Array.isArray(raw)) return undefined
  const skills = raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const skillID = typeof record.skill_id === 'string' ? record.skill_id.trim() : ''
    const skillName = typeof record.skill_name === 'string' ? record.skill_name.trim() : skillID
    const agentID = typeof record.agent_id === 'string' ? record.agent_id.trim() : ''
    const agentName = typeof record.agent_name === 'string' ? record.agent_name.trim() : agentID
    if (!skillID || !agentID) return []
    return [{
      skill_id: skillID,
      skill_name: skillName || skillID,
      skill_display_name: typeof record.skill_display_name === 'string' ? record.skill_display_name : undefined,
      skill_description: typeof record.skill_description === 'string' ? record.skill_description : undefined,
      skill_icon_url: typeof record.skill_icon_url === 'string' ? record.skill_icon_url : undefined,
      agent_id: agentID,
      agent_name: agentName || agentID,
      source: record.source === 'slash' ? 'slash' as const : record.source === 'skill_button' ? 'skill_button' as const : undefined,
    }]
  })
  return skills.length > 0 ? skills : undefined
}

function agentLoopStoreKey(channelId: string, agentId: string, runId?: string): string {
  return `${channelId}:${agentId}:${runId || '_legacy'}`
}

function eventRunId(event: { run_id?: string }): string | undefined {
  return typeof event.run_id === 'string' && event.run_id.trim() !== ''
    ? event.run_id
    : undefined
}

function metadataSeq(meta: Record<string, unknown>): number | undefined {
  return typeof meta.seq === 'number' && Number.isFinite(meta.seq) && meta.seq > 0
    ? meta.seq
    : undefined
}

function metadataEventId(meta: Record<string, unknown>, fallback: string): string {
  return typeof meta.event_id === 'string' && meta.event_id.trim() !== ''
    ? meta.event_id
    : fallback
}

function metadataToolCallId(meta: Record<string, unknown>): string | undefined {
  return typeof meta.tool_call_id === 'string' && meta.tool_call_id.trim() !== ''
    ? meta.tool_call_id
    : undefined
}

function eventSeq(event: { seq?: number }): number | undefined {
  return typeof event.seq === 'number' && Number.isFinite(event.seq) && event.seq > 0
    ? event.seq
    : undefined
}

function eventId(event: { event_id?: string }, fallback: string): string {
  return typeof event.event_id === 'string' && event.event_id.trim() !== ''
    ? event.event_id
    : fallback
}

function eventToolCallId(event: { tool_call_id?: string }): string | undefined {
  return typeof event.tool_call_id === 'string' && event.tool_call_id.trim() !== ''
    ? event.tool_call_id
    : undefined
}

function eventLoopKey(event: { channel_id: string; agent_id: string; run_id?: string }): string {
  return agentLoopStoreKey(event.channel_id, event.agent_id, eventRunId(event))
}

function findAgentLoopByRun(
  loops: Map<string, AgentLoopState>,
  channelId: string,
  runId?: string,
  agentId?: string,
): { key: string; loop?: AgentLoopState; agentId: string } | undefined {
  const normalizedRunId = typeof runId === 'string' && runId.trim() !== '' ? runId.trim() : undefined
  const normalizedAgentId = typeof agentId === 'string' && agentId.trim() !== '' ? agentId.trim() : undefined
  if (normalizedAgentId) {
    const key = agentLoopStoreKey(channelId, normalizedAgentId, normalizedRunId)
    return { key, loop: loops.get(key), agentId: normalizedAgentId }
  }
  if (normalizedRunId) {
    for (const [key, loop] of loops) {
      if (loop.channelId === channelId && loop.runId === normalizedRunId) {
        return { key, loop, agentId: loop.agentId }
      }
    }
  }
  return undefined
}

function localAgentRunSummary(event: { type: 'local_agent.run.succeeded' | 'local_agent.run.failed'; output?: unknown; error?: unknown }): string {
  if (event.type === 'local_agent.run.failed') {
    const err = event.error
    if (err && typeof err === 'object' && !Array.isArray(err)) {
      const message = (err as Record<string, unknown>).message
      if (typeof message === 'string' && message.trim() !== '') return message
      const code = (err as Record<string, unknown>).code
      if (typeof code === 'string' && code.trim() !== '') return `外部 Agent 运行失败：${code}`
    }
    return '外部 Agent 运行失败。'
  }
  const output = event.output
  if (output && typeof output === 'object' && !Array.isArray(output)) {
    const summary = (output as Record<string, unknown>).summary
    if (typeof summary === 'string' && summary.trim() !== '') return summary
  }
  return '外部 Agent 任务已完成。'
}

function compactLocalAgentText(value: unknown, max = 180): string {
  if (typeof value !== 'string') return ''
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function compactLocalAgentCommand(value: unknown): string {
  if (typeof value !== 'string') return ''
  let command = value.trim()
  command = command.replace(/^\/bin\/bash\s+-lc\s+['"]?/, '').replace(/['"]?$/, '')
  return compactLocalAgentText(command, 140)
}

function localAgentProgressSummary(event: {
  type: 'local_agent.run.started' | 'local_agent.run.progress' | 'local_agent.run.question' | 'local_agent.run.artifacts.ready' | 'local_agent.run.artifacts.uploaded'
  output?: unknown
}): string {
  if (event.type === 'local_agent.run.started') return '外部 Agent 已开始运行。'
  if (event.type === 'local_agent.run.question') return '外部 Agent 正在等待用户补充信息。'
  if (event.type === 'local_agent.run.artifacts.ready') return '外部 Agent 已生成产物，正在准备上传。'
  if (event.type === 'local_agent.run.artifacts.uploaded') return '外部 Agent 产物已上传。'

  const output = event.output
  if (!output || typeof output !== 'object' || Array.isArray(output)) return '外部 Agent 正在处理。'
  const record = output as Record<string, unknown>
  const eventType = typeof record.type === 'string' ? record.type : ''
  const kind = typeof record.kind === 'string' ? record.kind : ''
  if (eventType === 'external_agent.session.prepared') return '外部 Agent 工作区已准备完成。'
  if (eventType === 'external_agent.session.started') return '外部 Agent CLI 已启动。'
  if (eventType === 'external_agent.artifacts.ready') return '外部 Agent 已生成产物，正在准备上传。'
  if (eventType === 'external_agent.session.completed') return '外部 Agent 已完成执行，正在收集产物。'

  const text = compactLocalAgentText(record.text)
  if (kind === 'message' && text) return text
  if (kind === 'final' && text) return text
  if (kind === 'warning' && text) return text
  if (kind === 'command_started') {
    const command = compactLocalAgentCommand(record.command)
    return command ? `正在执行：${command}` : '外部 Agent 正在执行命令。'
  }
  if (kind === 'command_output') {
    const command = compactLocalAgentCommand(record.command)
    if (command) return `命令完成：${command}`
    if (text) return text
  }
  if (text) return text
  return '外部 Agent 正在处理。'
}

interface LocalAgentRunEventWire {
  id?: number
  run_id?: string
  seq?: number
  type?: string
  status?: string
  output?: unknown
  error?: unknown
  created_at?: string
}

interface LocalAgentRunWire {
  run_id?: string
  channel_id?: string
  skill_id?: string
  capability?: string
  status?: string
  output?: unknown
  error?: unknown
  created_at?: string
  started_at?: string
  completed_at?: string
  events?: LocalAgentRunEventWire[]
}

function localAgentEventSummary(event: LocalAgentRunEventWire): string {
  switch (event.type) {
    case 'local_agent.run.created':
      return '外部 Agent 任务已创建。'
    case 'local_agent.run.dispatched':
      return '已派发到外部 Agent Runtime。'
    case 'local_agent.run.started':
    case 'local_agent.run.progress':
    case 'local_agent.run.question':
    case 'local_agent.run.artifacts.ready':
    case 'local_agent.run.artifacts.uploaded':
      return localAgentProgressSummary({
        type: event.type,
        output: event.output,
      })
    case 'local_agent.run.succeeded':
    case 'local_agent.run.failed':
      return localAgentRunSummary({
        type: event.type,
        output: event.output,
        error: event.error,
      })
    default:
      return ''
  }
}

function timestampFromWire(value: unknown, fallback = Date.now()): number {
  if (typeof value !== 'string') return fallback
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : fallback
}

function applyLocalAgentRunsToLoops(
  channelId: string,
  loops: Map<string, AgentLoopState>,
  runs: LocalAgentRunWire[],
): Map<string, AgentLoopState> {
  if (runs.length === 0) return loops
  const next = new Map(loops)
  for (const run of runs) {
    const runId = typeof run.run_id === 'string' && run.run_id.trim() !== '' ? run.run_id.trim() : undefined
    if (!runId) continue
    const target = findAgentLoopByRun(next, channelId, runId)
    if (!target) continue

    let loop = ensureLoopTurn(
      target.loop,
      channelId,
      target.agentId,
      1,
      runId,
    )
    const events = [...(run.events ?? [])].sort((a, b) => {
      const aSeq = typeof a.seq === 'number' ? a.seq : Number.MAX_SAFE_INTEGER
      const bSeq = typeof b.seq === 'number' ? b.seq : Number.MAX_SAFE_INTEGER
      if (aSeq !== bSeq) return aSeq - bSeq
      return timestampFromWire(a.created_at, 0) - timestampFromWire(b.created_at, 0)
    })

    for (const event of events) {
      const summary = localAgentEventSummary(event)
      if (!summary) continue
      const timestamp = timestampFromWire(event.created_at, loop.startedAt)
      const turnNumber = 1
      loop = updateLoopTurn(loop, turnNumber, (turn) => ({
        ...turn,
        progress: summary,
        completedAt: event.type === 'local_agent.run.succeeded' || event.type === 'local_agent.run.failed'
          ? timestamp
          : turn.completedAt,
        status: event.type === 'local_agent.run.succeeded' || event.type === 'local_agent.run.failed'
          ? 'completed'
          : turn.status,
      }))
      loop = appendLoopEvent(loop, {
        id: `${target.key}:local-agent-event-${event.id ?? event.seq ?? timestamp}`,
        seq: eventSeq(event),
        type: 'progress',
        turnNumber,
        timestamp,
        summary,
      })
    }

    const completedAt = timestampFromWire(run.completed_at, 0)
    const startedAt = timestampFromWire(run.started_at ?? run.created_at, loop.startedAt)
    const terminalSummary = run.status === 'failed'
      ? localAgentRunSummary({ type: 'local_agent.run.failed', error: run.error })
      : run.status === 'succeeded'
        ? localAgentRunSummary({ type: 'local_agent.run.succeeded', output: run.output })
        : ''
    if (terminalSummary) {
      loop = updateLoopTurn(loop, 1, (turn) => ({
        ...turn,
        status: 'completed',
        progress: terminalSummary,
        completedAt: completedAt || turn.completedAt,
      }))
    }
    next.set(target.key, {
      ...loop,
      startedAt,
      completedAt: completedAt || loop.completedAt,
      status: run.status === 'succeeded'
        ? 'completed'
        : run.status === 'failed'
          ? 'error'
          : loop.status,
      finalContent: run.status === 'succeeded' && terminalSummary ? terminalSummary : loop.finalContent,
      error: run.status === 'failed' && terminalSummary ? terminalSummary : loop.error,
    })
  }
  return next
}

function normalizeAgentTodos(raw: unknown): AgentTodoItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const status = typeof record.status === 'string' ? record.status : 'pending'
    if (!id || !title) return []
    return [{
      id,
      title,
      status: (
        status === 'in_progress' || status === 'completed' || status === 'blocked' || status === 'skipped'
          ? status
          : 'pending'
      ) as AgentTodoItem['status'],
      seq: typeof record.seq === 'number' ? record.seq : index + 1,
      evidence: typeof record.evidence === 'string' ? record.evidence : undefined,
      blocker: typeof record.blocker === 'string' ? record.blocker : undefined,
      updated_at: typeof record.updated_at === 'string' ? record.updated_at : undefined,
      completed_at: typeof record.completed_at === 'string' ? record.completed_at : undefined,
    }]
  }).sort((a, b) => a.seq - b.seq)
}

function applyAgentTodoEvent(loop: AgentLoopState, todos?: AgentTodoItem[], todo?: AgentTodoItem): AgentLoopState {
  if (todos && todos.length > 0) {
    return { ...loop, todos: [...todos].sort((a, b) => a.seq - b.seq) }
  }
  if (!todo) return loop
  const current = loop.todos ?? []
  const exists = current.some((item) => item.id === todo.id)
  const next = exists
    ? current.map((item) => item.id === todo.id ? todo : item)
    : [...current, todo]
  return { ...loop, todos: next.sort((a, b) => a.seq - b.seq) }
}

function sortLoopEvents(events: AgentLoopEventItem[]): AgentLoopEventItem[] {
  return [...events].sort((a, b) => {
    const aSeq = a.seq ?? Number.MAX_SAFE_INTEGER
    const bSeq = b.seq ?? Number.MAX_SAFE_INTEGER
    if (aSeq !== bSeq) return aSeq - bSeq
    return a.timestamp - b.timestamp
  })
}

function compactEventText(value?: string): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function isDuplicateProgressEvent(a?: AgentLoopEventItem, b?: AgentLoopEventItem): boolean {
  if (!a || !b) return false
  return a.type === 'progress'
    && b.type === 'progress'
    && a.turnNumber === b.turnNumber
    && compactEventText(a.summary) !== ''
    && compactEventText(a.summary) === compactEventText(b.summary)
}

function appendLoopEvent(loop: AgentLoopState, item: AgentLoopEventItem): AgentLoopState {
  const current = loop.events ?? []
  if (current.some((event) => event.id === item.id)) {
    return {
      ...loop,
      events: sortLoopEvents(current.map((event) => event.id === item.id ? item : event)),
    }
  }
  const next = sortLoopEvents([...current, item])
  const compacted: AgentLoopEventItem[] = []
  for (const event of next) {
    if (isDuplicateProgressEvent(compacted[compacted.length - 1], event)) continue
    compacted.push(event)
  }
  return { ...loop, events: compacted }
}

function upsertAssistantContentEvent(
  loop: AgentLoopState,
  turnNumber: number,
  contentDelta: string,
  timestamp: number,
  id: string,
  seq?: number,
): AgentLoopState {
  if (!contentDelta) return loop
  const existing = (loop.events ?? []).find((event) => (
    event.type === 'assistant_content'
    && event.turnNumber === turnNumber
    && event.id === id
  ))
  const item: AgentLoopEventItem = existing
    ? { ...existing, content: `${existing.content ?? ''}${contentDelta}`, timestamp }
    : { id, seq, type: 'assistant_content', turnNumber, timestamp, content: contentDelta }
  return appendLoopEvent(loop, item)
}

export function parseMessage(m: Message, myUserId?: string): ChatMessage | null {
  const meta = (m.metadata ?? {}) as Record<string, unknown>

  if (isPersistedAgentLoopEvent(m)) {
    return null
  }

  if (m.msg_type === 'tool_call') {
    if (meta.name === 'ask_user' && Array.isArray(meta.questions)) {
      return {
        role: 'tool',
        content: '',
        toolName: 'ask_user',
        toolKind: 'call',
        timestamp: new Date(m.created_at).getTime(),
        msgId: m.id,
        senderName: meta.sender_display_name as string,
        senderAvatarUrl: meta.sender_avatar_url as string,
        senderId: m.sender_agent_id ?? undefined,
        agentRunId: metadataRunId(meta),
        senderType: m.sender_type === 'agent' ? 'agent' : undefined,
        askUserData: {
          questions: meta.questions as AskUserQuestion[],
          status: getAskUserStatus(meta),
          answers: meta.answers as Record<string, unknown> | undefined,
          askId: (meta._ask_id as string) || undefined,
          targetUserId: (meta.target_user_id as string) || undefined,
          targetUserIds: Array.isArray(meta.target_user_ids) ? meta.target_user_ids as string[] : undefined,
          visibility: (meta.visibility as 'target_user' | 'target_users' | 'mentioned_users' | 'channel_admins' | 'all_members') || undefined,
          expiresAt: (meta.expires_at as string) || undefined,
          skillEnableRequest: parseSkillEnableRequest(meta),
        },
      }
    }
    return {
      role: 'tool',
      content: (meta.hint as string) ?? '',
      toolName: (meta.name as string) ?? 'unknown',
      toolArgs: (meta.args as Record<string, unknown>) ?? undefined,
      toolKind: 'call',
      toolSuccess: true,
      timestamp: new Date(m.created_at).getTime(),
      msgId: m.id,
      senderName: meta.sender_display_name as string,
      senderAvatarUrl: meta.sender_avatar_url as string,
      senderId: m.sender_agent_id ?? undefined,
      agentRunId: metadataRunId(meta),
      senderType: m.sender_type === 'agent' ? 'agent' : undefined,
    }
  }

  if (m.msg_type === 'tool_result') {
    return {
      role: 'tool',
      content: (meta.output as string) ?? m.content,
      toolName: (meta.name as string) ?? 'unknown',
      toolKind: 'result',
      toolSuccess: meta.success !== false,
      toolDuration: meta.duration_secs as number | undefined,
      timestamp: new Date(m.created_at).getTime(),
      msgId: m.id,
      senderName: meta.sender_display_name as string,
      senderAvatarUrl: meta.sender_avatar_url as string,
      senderId: m.sender_agent_id ?? undefined,
      agentRunId: metadataRunId(meta),
      senderType: m.sender_type === 'agent' ? 'agent' : undefined,
    }
  }

	if (m.msg_type === 'system' || m.sender_type === 'system') {
		return {
			role: 'system',
			content: m.content,
			timestamp: new Date(m.created_at).getTime(),
			msgId: m.id,
			systemSource: (meta.source as string) || undefined,
			workflowTarget: workflowTargetFromMetadata(meta),
		}
	}

  if (meta.source === 'ask_user_answer') {
    const routing = meta.routing_info as Record<string, unknown> | undefined
    const targets = (routing?.target_agent_ids as string[]) ?? (meta.target_agent_id ? [meta.target_agent_id as string] : [])
    const targetAgentId = targets[0] || (meta.target_agent_id as string | undefined)
    return {
      role: 'system',
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
      msgId: m.id,
      senderName: meta.sender_display_name as string,
      senderAvatarUrl: meta.sender_avatar_url as string,
      senderId: m.sender_user_id ?? undefined,
      senderType: 'user',
      systemSource: 'ask_user_answer',
      routingInfo: {
        targets,
        method: (routing?.routing_method as string) || 'ask_user_resume',
      },
      askUserAnswerData: {
        askId: (meta.ask_id as string) || undefined,
        targetAgentId,
        targetAgentName: (meta.target_agent_name as string) || undefined,
        answers: meta.answers as Record<string, unknown> | undefined,
      },
    }
  }

  const isMe = m.sender_type === 'user' && m.sender_user_id === myUserId
  const role: 'user' | 'assistant' = isMe ? 'user' : 'assistant'

  const rawContent = m.msg_type === 'image'
    ? ((meta.image_url as string) || m.content)
    : m.content

  let quotedMessage: ChatMessage['quotedMessage'] | undefined
  let content = rawContent
  if (rawContent.startsWith('> ')) {
    const nl = rawContent.indexOf('\n\n')
    if (nl > 0) {
      const quoteLine = rawContent.slice(2, nl)
      const colon = quoteLine.indexOf(': ')
      if (colon > 0) {
        quotedMessage = {
          senderName: quoteLine.slice(0, colon),
          content: quoteLine.slice(colon + 2),
        }
        content = rawContent.slice(nl + 2)
      }
    }
  }

  return {
    role,
    content,
    timestamp: new Date(m.created_at).getTime(),
    msgId: m.id,
    quotedMessage,
    isAgent: m.sender_type === 'agent',
    senderName: meta.sender_display_name as string,
    senderAvatarUrl: meta.sender_avatar_url as string,
    senderType: (m.sender_type === 'user' || m.sender_type === 'agent') ? m.sender_type : undefined,
    senderId: m.sender_agent_id ?? m.sender_user_id ?? undefined,
    agentRunId: m.sender_type === 'agent' ? metadataRunId(meta) : undefined,
    contentType: m.msg_type !== 'text' ? m.msg_type : undefined,
    suggestions: Array.isArray(meta.suggestions) ? meta.suggestions as string[] : undefined,
    thinkingContent: (meta.thinking_content as string) || undefined,
    selectedSkills: parseSelectedSkills(meta),
    routingInfo: meta.routing_info ? {
      targets: ((meta.routing_info as Record<string, unknown>).target_agent_ids as string[]) ?? [],
      method: ((meta.routing_info as Record<string, unknown>).routing_method as string) ?? '',
    } : undefined,
  }
}

function buildAgentLoopsFromMessages(channelId: string, messages: Message[]): Map<string, AgentLoopState> {
  const loops = new Map<string, AgentLoopState>()
  const latestEventAt = new Map<string, number>()
  const expiredAskAt = new Map<string, number>()

  for (const message of messages) {
    const agentId = message.sender_agent_id
    if (!agentId) continue

    const meta = (message.metadata ?? {}) as Record<string, unknown>
    const runId = metadataRunId(meta)
    const key = agentLoopStoreKey(channelId, agentId, runId)
    const timestamp = new Date(message.created_at).getTime()
    const seq = metadataSeq(meta)
    const storedEvent = typeof meta.event === 'string' ? meta.event : ''
    const storedEventId = metadataEventId(meta, `${message.id}`)
    const toolCallId = metadataToolCallId(meta)

    if (meta.source !== 'agent_loop') {
      if (message.msg_type === 'tool_call' && meta.name === 'ask_user' && getAskUserStatus(meta) === 'expired') {
        const expiresAt = typeof meta.expires_at === 'string' ? Date.parse(meta.expires_at) : NaN
        expiredAskAt.set(key, Number.isFinite(expiresAt) ? expiresAt : timestamp)
      }
      if (message.sender_type === 'agent' && message.msg_type === 'text') {
        const loop = loops.get(key)
        if (loop && loop.status === 'running') {
          const turn = loop.turns[loop.turns.length - 1]
          const completedTurn = turn
            ? { ...turn, status: 'completed' as const, content: message.content, completedAt: timestamp }
            : undefined
          loops.set(key, {
            ...loop,
            turns: completedTurn ? [...loop.turns.slice(0, -1), completedTurn] : loop.turns,
            status: 'completed',
            finalContent: message.content,
            completedAt: timestamp,
          })
        }
      }
      continue
    }
    latestEventAt.set(key, timestamp)

    const turnNumber = typeof meta.turn === 'number' && meta.turn > 0 ? meta.turn : 1
    let loop = loops.get(key)
    if (!loop || meta.event === 'agent_ack') {
      loop = {
        runId,
        agentId,
        channelId,
        turns: [],
        status: 'running',
        currentTurn: turnNumber,
        startedAt: timestamp,
      }
      loops.set(key, loop)
    }

    let turn = loop.turns.find((t) => t.turnNumber === turnNumber)
    if (!turn) {
      turn = {
        turnNumber,
        toolCalls: [],
        skillUses: [],
        status: 'active',
        startedAt: timestamp,
      }
      loop = { ...loop, turns: [...loop.turns, turn], currentTurn: turnNumber }
      loops.set(key, loop)
    }

    if (meta.event === 'agent_todo_snapshot' || meta.event === 'agent_todo_updated') {
      const todos = normalizeAgentTodos(meta.todos)
      const todo = normalizeAgentTodos(meta.todo ? [meta.todo] : [])[0]
      loop = applyAgentTodoEvent(loop, todos.length > 0 ? todos : undefined, todo)
      loops.set(key, loop)
    } else if (meta.event === 'skill_use') {
      const skillUse: AgentLoopSkillUse = {
        id: `${message.id}`,
        seq,
        name: (meta.name as string) || 'unknown',
        displayName: meta.display_name as string | undefined,
        description: meta.description as string | undefined,
        iconUrl: meta.icon_url as string | undefined,
        status: ((meta.status as string) || 'injected') as AgentLoopSkillUse['status'],
        reason: meta.reason as string | undefined,
        startedAt: timestamp,
      }
      turn = {
        ...turn,
        skillUses: [
          ...(turn.skillUses ?? []),
          skillUse,
        ],
      }
      loop = appendLoopEvent(loop, {
        id: storedEventId,
        seq,
        messageId: message.id,
        type: 'skill_use',
        turnNumber,
        timestamp,
        skill: skillUse,
      })
      loops.set(key, loop)
    } else if (message.msg_type === 'thinking') {
      if (meta.event === 'assistant_content') {
        turn = { ...turn, content: `${turn.content ?? ''}${message.content}` }
        loop = appendLoopEvent(loop, {
          id: storedEventId,
          seq,
          messageId: message.id,
          type: 'assistant_content',
          turnNumber,
          timestamp,
          content: message.content,
        })
        loops.set(key, loop)
      } else {
        turn = { ...turn, progress: message.content }
        if (
          storedEvent !== 'agent_done'
          && storedEvent !== 'agent_stopped'
          && storedEvent !== 'agent_error'
          && storedEvent !== 'agent_interrupted'
          && storedEvent !== 'max_turns_reached'
          && storedEvent !== 'agent_waiting_user'
          && storedEvent !== 'agent_ask_user_expired'
        ) {
          loop = appendLoopEvent(loop, {
            id: storedEventId,
            seq,
            messageId: message.id,
            type: 'progress',
            turnNumber,
            timestamp,
            summary: message.content,
          })
          loops.set(key, loop)
        }
      }
    } else if (message.msg_type === 'tool_call') {
      const tool: AgentLoopToolCall = {
        id: `${message.id}`,
        toolCallId,
        seq,
        name: (meta.name as string) || 'unknown',
        args: meta.args as Record<string, unknown> | undefined,
        status: 'calling',
        startedAt: timestamp,
        parallel: Boolean(meta.parallel),
        batchId: meta.batch_id as string | undefined,
      }
      turn = { ...turn, toolCalls: [...turn.toolCalls, tool] }
      loop = appendLoopEvent(loop, {
        id: storedEventId,
        seq,
        messageId: message.id,
        type: 'tool_call',
        turnNumber,
        timestamp,
        tool,
      })
      loops.set(key, loop)
    } else if (message.msg_type === 'tool_result') {
      const name = (meta.name as string) || 'unknown'
      const idx = [...turn.toolCalls].reverse().findIndex((tc) => (
        toolCallId
          ? tc.toolCallId === toolCallId || tc.id === toolCallId
          : tc.name === name && tc.status === 'calling'
      ))
      let resultTool: AgentLoopToolCall
      if (idx >= 0) {
        const realIdx = turn.toolCalls.length - 1 - idx
        const updated = {
          ...turn.toolCalls[realIdx]!,
          toolCallId: turn.toolCalls[realIdx]!.toolCallId ?? toolCallId,
          status: meta.success !== false ? 'success' as const : 'failed' as const,
          output: (meta.output as string) || message.content,
          completedAt: timestamp,
        }
        turn = {
          ...turn,
          toolCalls: [
            ...turn.toolCalls.slice(0, realIdx),
            updated,
            ...turn.toolCalls.slice(realIdx + 1),
          ],
        }
        resultTool = updated
      } else {
        resultTool = {
          id: `${message.id}`,
          toolCallId,
          seq,
          name,
          status: meta.success !== false ? 'success' : 'failed',
          output: (meta.output as string) || message.content,
          startedAt: timestamp,
          completedAt: timestamp,
        }
        turn = {
          ...turn,
          toolCalls: [
            ...turn.toolCalls,
            resultTool,
          ],
        }
      }
      loop = appendLoopEvent(loop, {
        id: storedEventId,
        seq,
        messageId: message.id,
        type: 'tool_result',
        turnNumber,
        timestamp,
        tool: resultTool,
      })
      loops.set(key, loop)
    }

    loop = loops.get(key)!
    let nextLoop: AgentLoopState = {
      ...loop,
      turns: loop.turns.map((t) => t.turnNumber === turnNumber ? turn : t),
      currentTurn: turnNumber,
    }
    if (meta.event === 'agent_stopped') {
      const stoppedTurn = { ...turn, status: 'completed' as const, completedAt: timestamp }
      nextLoop = {
        ...nextLoop,
        turns: nextLoop.turns.map((t) => t.turnNumber === turnNumber ? stoppedTurn : t),
        status: 'stopped',
        error: message.content || '任务已停止。',
        completedAt: timestamp,
      }
    }
    if (meta.event === 'agent_error') {
      const errorTurn = { ...turn, status: 'completed' as const, completedAt: timestamp }
      nextLoop = {
        ...nextLoop,
        turns: nextLoop.turns.map((t) => t.turnNumber === turnNumber ? errorTurn : t),
        status: 'error',
        error: message.content,
        completedAt: timestamp,
      }
    }
    if (meta.event === 'agent_done') {
      const doneTurn = {
        ...turn,
        status: 'completed' as const,
        progress: message.content || turn.progress,
        content: message.content || turn.content,
        completedAt: timestamp,
      }
      nextLoop = {
        ...nextLoop,
        turns: nextLoop.turns.map((t) => t.turnNumber === turnNumber ? doneTurn : t),
        status: 'completed',
        finalContent: message.content || nextLoop.finalContent,
        completedAt: timestamp,
      }
    }
    if (meta.event === 'max_turns_reached') {
      const maxTurnsTurn = { ...turn, status: 'completed' as const, completedAt: timestamp }
      nextLoop = {
        ...nextLoop,
        turns: nextLoop.turns.map((t) => t.turnNumber === turnNumber ? maxTurnsTurn : t),
        status: 'max_turns_reached',
        completedAt: timestamp,
      }
    }
    if (meta.event === 'agent_interrupted') {
      const interruptedTurn = { ...turn, status: 'completed' as const, completedAt: timestamp }
      nextLoop = {
        ...nextLoop,
        turns: nextLoop.turns.map((t) => t.turnNumber === turnNumber ? interruptedTurn : t),
        status: 'interrupted',
        error: message.content || '任务已中断。',
        completedAt: timestamp,
      }
    }
    if (meta.event === 'agent_waiting_user') {
      const waitingTurn = {
        ...turn,
        status: 'completed' as const,
        progress: message.content || turn.progress || 'Agent 正在等待用户补充信息。',
        completedAt: timestamp,
      }
      nextLoop = {
        ...nextLoop,
        turns: nextLoop.turns.map((t) => t.turnNumber === turnNumber ? waitingTurn : t),
        status: 'waiting_for_user',
        completedAt: timestamp,
      }
    }
    if (meta.event === 'agent_ask_user_expired') {
      const expiredTurn = {
        ...turn,
        status: 'completed' as const,
        progress: message.content || turn.progress || '用户未在限定时间内回答，Agent 已停止等待。',
        completedAt: timestamp,
      }
      nextLoop = {
        ...nextLoop,
        turns: nextLoop.turns.map((t) => t.turnNumber === turnNumber ? expiredTurn : t),
        status: 'waiting_expired',
        error: message.content || '等待用户回答已超时。',
        completedAt: timestamp,
      }
    }
    loops.set(key, nextLoop)
  }

  for (const [key, expiredAt] of expiredAskAt) {
    const loop = loops.get(key)
    if (!loop || (loop.status !== 'waiting_for_user' && loop.status !== 'running')) continue
    const turns = loop.turns.map((turn, index) => (
      index === loop.turns.length - 1
        ? { ...turn, status: 'completed' as const, progress: '用户未在限定时间内回答，Agent 已停止等待。', completedAt: expiredAt }
        : turn
    ))
    loops.set(key, {
      ...loop,
      turns,
      status: 'waiting_expired',
      error: '等待用户回答已超时。',
      completedAt: expiredAt,
    })
  }

  const now = Date.now()
  for (const [key, loop] of loops) {
    if (loop.status !== 'running') continue
    const latestAt = latestEventAt.get(key) ?? loop.startedAt
    if (now - latestAt <= AGENT_LOOP_STALE_AFTER_MS) continue
    const turns = loop.turns.map((turn, index) => (
      index === loop.turns.length - 1 && turn.status === 'active'
        ? { ...turn, status: 'completed' as const, progress: turn.progress || AGENT_LOOP_STALE_MESSAGE, completedAt: latestAt }
        : turn
    ))
    loops.set(key, {
      ...loop,
      turns,
      status: 'interrupted',
      completedAt: latestAt,
      error: AGENT_LOOP_STALE_MESSAGE,
    })
  }

  return loops
}

function eventTurnNumber(event: { turn?: number }, loop?: AgentLoopState): number {
  return typeof event.turn === 'number' && event.turn > 0
    ? event.turn
    : loop?.currentTurn || loop?.turns[loop.turns.length - 1]?.turnNumber || 1
}

function ensureLoopTurn(
  loop: AgentLoopState | undefined,
  channelId: string,
  agentId: string,
  turnNumber: number,
  runId?: string,
): AgentLoopState {
  const now = Date.now()
  const base: AgentLoopState = loop ?? {
    runId,
    agentId,
    channelId,
    turns: [],
    status: 'running',
    currentTurn: turnNumber,
    startedAt: now,
  }

  const turns = base.turns.map((turn) => (
    turn.status === 'active' && turn.turnNumber < turnNumber
      ? { ...turn, status: 'completed' as const, completedAt: turn.completedAt ?? now }
      : turn
  ))

  if (!turns.some((turn) => turn.turnNumber === turnNumber)) {
    turns.push({
      turnNumber,
      toolCalls: [],
      skillUses: [],
      status: 'active',
      startedAt: now,
    })
  }

  turns.sort((a, b) => a.turnNumber - b.turnNumber)

  return {
    ...base,
    turns,
    status: 'running',
    currentTurn: Math.max(base.currentTurn, turnNumber),
    completedAt: undefined,
    error: undefined,
  }
}

function updateLoopTurn(
  loop: AgentLoopState,
  turnNumber: number,
  updater: (turn: AgentLoopTurn) => AgentLoopTurn,
): AgentLoopState {
  return {
    ...loop,
    turns: loop.turns.map((turn) => (
      turn.turnNumber === turnNumber ? updater(turn) : turn
    )),
    currentTurn: Math.max(loop.currentTurn, turnNumber),
  }
}

function agentLoopActivityAt(loop: AgentLoopState): number {
  let latest = loop.completedAt ?? loop.startedAt ?? 0
  for (const turn of loop.turns) {
    latest = Math.max(latest, turn.completedAt ?? turn.startedAt ?? 0)
    for (const tool of turn.toolCalls) {
      latest = Math.max(latest, tool.completedAt ?? tool.startedAt ?? 0)
    }
  }
  return latest
}

function streamActivityAt(stream: StreamState): number {
  return stream.agentLoop ? agentLoopActivityAt(stream.agentLoop) : 0
}

function typingKey(channelId: string, agentId?: string): string {
  return `${channelId}:${agentId || '_'}`
}

function clearTypingForChannel(typing: Map<string, string>, channelId: string, agentId?: string) {
  if (agentId) {
    typing.delete(typingKey(channelId, agentId))
    return
  }
  typing.delete(channelId)
  for (const key of [...typing.keys()]) {
    if (key.startsWith(`${channelId}:`)) {
      typing.delete(key)
    }
  }
}

// ── Store ──

export interface MessagesState {
  messages: Map<string, ChatMessage[]>
  streams: Map<string, StreamState>
  agentLoops: Map<string, AgentLoopState>
  members: Map<string, ChannelMemberInfo[]>
  typingStatus: Map<string, string>
  loadingChannel: string | null

  fetchMessages: (channelId: string) => Promise<void>
  fetchMembers: (channelId: string) => Promise<void>
  handleEvent: (event: WSEvent) => void
  addOptimisticMessage: (channelId: string, content: string, metadata?: Record<string, unknown>) => void
  submitAskUserAnswer: (channelId: string, askId: string, answers: Record<string, unknown>) => void
  getMessages: (channelId: string) => ChatMessage[]
  getStream: (channelId: string) => StreamState | undefined
  getStreams: (channelId: string) => StreamState[]
  getAgentLoop: (channelId: string) => AgentLoopState | undefined
  getAgentLoops: (channelId: string) => AgentLoopState[]
  getMembers: (channelId: string) => ChannelMemberInfo[]
  getTyping: (channelId: string) => string
  getTypings: (channelId: string) => string[]
  reset: () => void
}

export interface MessagesStoreConfig {
  api: KyInstance
  getCurrentChannelId: () => string | null
  getCurrentUserId: () => string | undefined
  sendWsCommand: (cmd: unknown) => void
}

function latestUserMessageAt(messages: ChatMessage[] | undefined): number {
  let latest = 0
  for (const message of messages ?? []) {
    if (message.role === 'user') {
      latest = Math.max(latest, message.timestamp)
    }
  }
  return latest
}

function isTerminalAgentLoop(loop: AgentLoopState | undefined): boolean {
  if (!loop) return false
  return loop.status !== 'running' && loop.status !== 'waiting_for_user'
}

function shouldIgnoreStaleLiveAgentEvent(
  state: MessagesState,
  event: { channel_id: string; agent_id: string; run_id?: string },
): boolean {
  const loop = state.agentLoops.get(eventLoopKey(event))
  if (!isTerminalAgentLoop(loop) || !loop?.completedAt) return false
  const latestUserAt = latestUserMessageAt(state.messages.get(event.channel_id))
  return latestUserAt === 0 || loop.completedAt >= latestUserAt
}

export function createMessagesStore(config: MessagesStoreConfig) {
  return createStore<MessagesState>()((set, get) => ({
    messages: new Map(),
    streams: new Map(),
    agentLoops: new Map(),
    members: new Map(),
    typingStatus: new Map(),
    loadingChannel: null,

    fetchMessages: async (channelId) => {
      set({ loadingChannel: channelId })
      try {
        const msgs = await config.api.get(`channels/${channelId}/messages`).json<Message[]>()
        let localAgentRuns: LocalAgentRunWire[] = []
        try {
          const localAgentData = await config.api.get('local-agent/runs', {
            searchParams: { channel_id: channelId },
          }).json<{ runs?: LocalAgentRunWire[] }>()
          localAgentRuns = Array.isArray(localAgentData.runs) ? localAgentData.runs : []
        } catch {
          localAgentRuns = []
        }
        const userId = config.getCurrentUserId()
        const parsed = msgs
          .map((m) => parseMessage(m, userId))
          .filter((m): m is ChatMessage => m !== null)
        const visibleRunIds = new Set(
          msgs.flatMap((m) => {
            const runId = metadataRunId((m.metadata ?? {}) as Record<string, unknown>)
            return runId ? [runId] : []
          }),
        )
        const map = new Map(get().messages)
        map.set(channelId, parsed)
        const loops = new Map(get().agentLoops)
        for (const key of loops.keys()) {
          if (key.startsWith(`${channelId}:`)) {
            loops.delete(key)
          }
        }
        for (const [key, loop] of buildAgentLoopsFromMessages(channelId, msgs)) {
          loops.set(key, loop)
        }
        const visibleLocalAgentRuns = localAgentRuns.filter((run) => (
          typeof run.run_id === 'string' && visibleRunIds.has(run.run_id)
        ))
        const hydratedLoops = applyLocalAgentRunsToLoops(channelId, loops, visibleLocalAgentRuns)
        set({ messages: map, agentLoops: hydratedLoops, loadingChannel: null })
      } catch {
        set({ loadingChannel: null })
      }
    },

    fetchMembers: async (channelId) => {
      try {
        const raw = await config.api.get(`channels/${channelId}/members`).json<ChannelMemberInfo[]>()
        const data = raw
          .map((m) => ({
            ...m,
            display_name: m.display_name || m.nickname || m.agent_id || m.user_id || 'unknown',
          }))
        const map = new Map(get().members)
        map.set(channelId, data)
        set({ members: map })
      } catch {
        // ignore
      }
    },

    addOptimisticMessage: (channelId, content, metadata) => {
      const map = new Map(get().messages)
      const msgs = [...(map.get(channelId) || [])]
      const meta = metadata ?? {}
      msgs.push({
        role: 'user',
        content,
        timestamp: Date.now(),
        senderType: 'user',
        selectedSkills: parseSelectedSkills(meta),
      })
      map.set(channelId, msgs)
      set({ messages: map })
    },

    handleEvent: (event) => {
      const state = get()
      const userId = config.getCurrentUserId()

      switch (event.type) {
        case 'message': {
          const parsed = parseMessage(event.message, userId)
          if (!parsed) break
          const map = new Map(state.messages)
          let msgs = [...(map.get(event.channel_id) || [])]
          const existingIdx = msgs.findIndex((m) => m.msgId === parsed.msgId)
          if (existingIdx >= 0) {
            msgs[existingIdx] = parsed
            map.set(event.channel_id, msgs)
            set({ messages: map })
            break
          }
          const optIdx = parsed.role === 'user'
            ? msgs.findIndex((m) => m.role === 'user' && !m.msgId && m.content === parsed.content)
            : -1
          if (optIdx >= 0) {
            msgs[optIdx] = parsed
          } else {
            msgs.push(parsed)
          }
          map.set(event.channel_id, msgs)
          set({ messages: map })

          if (parsed.senderType === 'agent' && parsed.senderId) {
            const streams = new Map(get().streams)
            streams.delete(agentLoopStoreKey(event.channel_id, parsed.senderId, parsed.agentRunId))
            set({ streams })
          }
          break
        }

        case 'routing_info': {
          if (!event.routing_info) break
          const ri = event.routing_info as { routing_method: string; target_agent_ids: string[]; reason: string }
          const map = new Map(state.messages)
          const msgs = [...(map.get(event.channel_id) || [])]
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'user') {
              msgs[i] = { ...msgs[i], routingInfo: { targets: ri.target_agent_ids, method: ri.routing_method } }
              break
            }
          }
          map.set(event.channel_id, msgs)
          set({ messages: map })
          break
        }

        case 'typing': {
          const typing = new Map(state.typingStatus)
          typing.set(typingKey(event.channel_id, event.agent_id), `${event.agent_id || 'Agent'} 正在输入...`)
          set({ typingStatus: typing })
          break
        }

        case 'chunk': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const streams = new Map(state.streams)
          const key = eventLoopKey(event)
          const existing = streams.get(key)
          const loops = new Map(state.agentLoops)
          const turnNumber = eventTurnNumber(event, existing?.agentLoop ?? loops.get(key))
          let agentLoop = ensureLoopTurn(existing?.agentLoop ?? loops.get(key), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          agentLoop = updateLoopTurn(agentLoop, turnNumber, (turn) => ({
            ...turn,
            content: (turn.content || '') + event.content,
          }))
          agentLoop = upsertAssistantContentEvent(
            agentLoop,
            turnNumber,
            event.content,
            Date.now(),
            `${key}:turn-${turnNumber}:assistant-content`,
            eventSeq(event),
          )
          loops.set(key, agentLoop)
          set({ agentLoops: loops })
          streams.set(key, {
            agentId: event.agent_id,
            runId: eventRunId(event),
            content: (existing?.content || '') + event.content,
            thinking: existing?.thinking || '',
            agentLoop,
          })
          set({ streams })
          break
        }

        case 'thinking': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const streams = new Map(state.streams)
          const key = eventLoopKey(event)
          const existing = streams.get(key)
          streams.set(key, {
            agentId: event.agent_id,
            runId: eventRunId(event),
            content: existing?.content || '',
            thinking: (existing?.thinking || '') + event.content,
            agentLoop: existing?.agentLoop,
          })
          set({ streams })
          break
        }

        case 'thinking_content': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const streams = new Map(state.streams)
          const key = eventLoopKey(event)
          const existing = streams.get(key)
          streams.set(key, {
            agentId: event.agent_id,
            runId: eventRunId(event),
            content: existing?.content || '',
            thinking: (existing?.thinking || '') + event.content,
            agentLoop: existing?.agentLoop,
          })
          set({ streams })
          break
        }

        case 'message_end': {
          const streams = new Map(state.streams)
          const streamKey = eventLoopKey(event)
          streams.delete(streamKey)
          set({ streams })

          if (event.message) {
            const parsed = parseMessage(event.message, userId)
            if (parsed) {
              const map = new Map(state.messages)
              const msgs = [...(map.get(event.channel_id) || [])]
              if (!msgs.some((m) => m.msgId === parsed.msgId)) {
                msgs.push(parsed)
                map.set(event.channel_id, msgs)
                set({ messages: map })
              }
            }
          }
          const loops = new Map(state.agentLoops)
          const loop = loops.get(streamKey)
          if (loop) {
            const finalContent = event.message?.content ?? loop.finalContent
            const turnNumber = eventTurnNumber(event, loop)
            const updatedTurns = loop.turns.map((turn) => (
              turn.turnNumber === turnNumber
                ? { ...turn, status: 'completed' as const, content: finalContent, completedAt: Date.now() }
                : turn
            ))
            loops.set(streamKey, {
              ...loop,
              turns: updatedTurns,
              status: 'completed',
              finalContent,
              completedAt: Date.now(),
            })
            set({ agentLoops: loops })
          }

          const typing = new Map(state.typingStatus)
          clearTypingForChannel(typing, event.channel_id, event.agent_id)
          set({ typingStatus: typing })
          break
        }

        case 'tool_call': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const streams = new Map(state.streams)
          const key = eventLoopKey(event)
          const existing = streams.get(key)
          const loops = new Map(state.agentLoops)
          const turnNumber = eventTurnNumber(event, existing?.agentLoop ?? loops.get(key))
          let agentLoop = ensureLoopTurn(existing?.agentLoop ?? loops.get(key), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          const toolCall: AgentLoopToolCall = {
            id: eventToolCallId(event) || `${event.name}-${eventSeq(event) ?? Date.now()}`,
            toolCallId: eventToolCallId(event),
            seq: eventSeq(event),
            name: event.name,
            args: event.args as Record<string, unknown>,
            status: 'calling',
            startedAt: Date.now(),
            parallel: (event as { parallel?: boolean }).parallel,
            batchId: (event as { batch_id?: string }).batch_id,
          }
          agentLoop = updateLoopTurn(agentLoop, turnNumber, (turn) => ({
            ...turn,
            toolCalls: [...turn.toolCalls, toolCall],
          }))
          agentLoop = appendLoopEvent(agentLoop, {
            id: eventId(event, `${toolCall.id}:call`),
            seq: eventSeq(event),
            type: 'tool_call',
            turnNumber,
            timestamp: Date.now(),
            tool: toolCall,
          })
          loops.set(key, agentLoop)
          set({ agentLoops: loops })

          const newStream: StreamState = {
            agentId: event.agent_id,
            runId: eventRunId(event),
            content: existing?.content || '',
            thinking: existing?.thinking || '',
            toolCall: { name: event.name, args: event.args },
            agentLoop,
          }

          streams.set(key, newStream)
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.set(typingKey(event.channel_id, event.agent_id), `${event.agent_id} 调用工具 ${event.name}...`)
          set({ typingStatus: typing })
          break
        }

        case 'tool_result': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const streams = new Map(state.streams)
          const key = eventLoopKey(event)
          const existing = streams.get(key)
          const loops = new Map(state.agentLoops)
          const turnNumber = eventTurnNumber(event, existing?.agentLoop ?? loops.get(key))
          let agentLoop = ensureLoopTurn(existing?.agentLoop ?? loops.get(key), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          let resultTool: AgentLoopToolCall | undefined
          agentLoop = updateLoopTurn(agentLoop, turnNumber, (turn) => {
            let nextTurn = turn
            if (nextTurn) {
              const idx = [...turn.toolCalls].reverse().findIndex(
                (tc) => eventToolCallId(event)
                  ? tc.toolCallId === eventToolCallId(event) || tc.id === eventToolCallId(event)
                  : tc.name === event.name && tc.status === 'calling',
              )
              if (idx >= 0) {
                const realIdx = turn.toolCalls.length - 1 - idx
                const updated = { ...turn.toolCalls[realIdx]! }
                updated.toolCallId = updated.toolCallId ?? eventToolCallId(event)
                updated.status = event.success !== false ? 'success' : 'failed'
                updated.output = event.output
                updated.completedAt = Date.now()
                resultTool = updated
                nextTurn = {
                  ...turn,
                  toolCalls: [
                    ...turn.toolCalls.slice(0, realIdx),
                    updated,
                    ...turn.toolCalls.slice(realIdx + 1),
                  ],
                }
              } else {
                resultTool = {
                  id: eventToolCallId(event) || `${event.name}-${eventSeq(event) ?? Date.now()}`,
                  toolCallId: eventToolCallId(event),
                  seq: eventSeq(event),
                  name: event.name,
                  status: event.success !== false ? 'success' : 'failed',
                  output: event.output,
                  startedAt: Date.now(),
                  completedAt: Date.now(),
                }
                nextTurn = {
                  ...turn,
                  toolCalls: [
                    ...turn.toolCalls,
                    resultTool,
                  ],
                }
              }
            }
            return nextTurn
          })
          if (resultTool) {
            agentLoop = appendLoopEvent(agentLoop, {
              id: eventId(event, `${resultTool.id}:result`),
              seq: eventSeq(event),
              type: 'tool_result',
              turnNumber,
              timestamp: Date.now(),
              tool: resultTool,
            })
          }
          loops.set(key, agentLoop)
          set({ agentLoops: loops })

          streams.set(key, {
            agentId: event.agent_id,
            runId: eventRunId(event),
            content: existing?.content || '',
            thinking: existing?.thinking || '',
            agentLoop,
            toolCall: undefined,
          })
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.set(typingKey(event.channel_id, event.agent_id), `${event.agent_id} 正在思考...`)
          set({ typingStatus: typing })
          break
        }

        case 'skill_use': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const streams = new Map(state.streams)
          const key = eventLoopKey(event)
          const existing = streams.get(key)
          const loops = new Map(state.agentLoops)
          const turnNumber = eventTurnNumber(event, existing?.agentLoop ?? loops.get(key))
          let agentLoop = ensureLoopTurn(existing?.agentLoop ?? loops.get(key), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          const skillUse: AgentLoopSkillUse = {
            id: `${event.name}-${eventSeq(event) ?? Date.now()}`,
            seq: eventSeq(event),
            name: event.name,
            displayName: event.display_name,
            description: event.description,
            iconUrl: event.icon_url,
            status: event.status || 'injected',
            reason: event.reason,
            startedAt: Date.now(),
          }
          agentLoop = updateLoopTurn(agentLoop, turnNumber, (turn) => ({
            ...turn,
            skillUses: [
              ...(turn.skillUses ?? []),
              skillUse,
            ],
          }))
          agentLoop = appendLoopEvent(agentLoop, {
            id: eventId(event, skillUse.id),
            seq: eventSeq(event),
            type: 'skill_use',
            turnNumber,
            timestamp: Date.now(),
            skill: skillUse,
          })
          loops.set(key, agentLoop)
          set({ agentLoops: loops })

          streams.set(key, {
            agentId: event.agent_id,
            runId: eventRunId(event),
            content: existing?.content || '',
            thinking: existing?.thinking || '',
            toolCall: existing?.toolCall,
            agentLoop,
          })
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.set(typingKey(event.channel_id, event.agent_id), `${event.agent_id} 启用技能 ${event.display_name || event.name}`)
          set({ typingStatus: typing })
          break
        }

        // ── Agent Loop events ──

        case 'agent_ack': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const loops = new Map(state.agentLoops)
          const loopKey = eventLoopKey(event)
          const existing = loops.get(loopKey)
          if (existing?.status === 'running' && event.turn <= existing.currentTurn) {
            break
          }
          const shouldContinueExisting = existing?.status === 'running' || existing?.status === 'waiting_for_user'
          const turnNumber = shouldContinueExisting && existing && event.turn <= existing.currentTurn
            ? existing.currentTurn + 1
            : event.turn

          const newTurn: AgentLoopTurn = {
            turnNumber,
            toolCalls: [],
            skillUses: [],
            status: 'active',
            startedAt: Date.now(),
          }

          let loop: AgentLoopState = shouldContinueExisting && existing
            ? {
                ...existing,
                status: 'running',
                currentTurn: turnNumber,
                turns: [...existing.turns, newTurn],
                completedAt: undefined,
                error: undefined,
              }
            : {
                runId: eventRunId(event),
                agentId: event.agent_id,
                channelId: event.channel_id,
                turns: [newTurn],
                status: 'running',
                currentTurn: turnNumber,
                startedAt: Date.now(),
              }

          if (event.content) {
            loop = appendLoopEvent(loop, {
              id: eventId(event, `${loopKey}:ack-${turnNumber}`),
              seq: eventSeq(event),
              type: 'progress',
              turnNumber,
              timestamp: Date.now(),
              summary: event.content,
            })
          }

          loops.set(loopKey, loop)
          set({ agentLoops: loops })

          // Attach to stream
          const streams = new Map(state.streams)
          const streamKey = eventLoopKey(event)
          const stream = streams.get(streamKey)
          streams.set(streamKey, {
            agentId: event.agent_id,
            runId: eventRunId(event),
            content: stream?.content || '',
            thinking: stream?.thinking || '',
            toolCall: stream?.toolCall,
            agentLoop: loop,
          })
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.set(typingKey(event.channel_id, event.agent_id), `${event.agent_id} 开始第 ${event.turn} 轮...`)
          set({ typingStatus: typing })
          break
        }

        case 'agent_thinking': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const loops = new Map(state.agentLoops)
          const loopKey = eventLoopKey(event)
          const turnNumber = eventTurnNumber(event, loops.get(loopKey))
          let updated = ensureLoopTurn(loops.get(loopKey), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          updated = updateLoopTurn(updated, turnNumber, (turn) => ({
            ...turn,
            thinking: (turn.thinking || '') + (event.content || ''),
          }))
          loops.set(loopKey, updated)
          set({ agentLoops: loops })

          // Sync to stream
          const streams = new Map(state.streams)
          const streamKey = eventLoopKey(event)
          const stream = streams.get(streamKey)
          if (stream) {
            streams.set(streamKey, { ...stream, agentLoop: updated })
            set({ streams })
          }
          break
        }

        case 'agent_turn_start': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const loops = new Map(state.agentLoops)
          const loopKey = eventLoopKey(event)
          const loop = ensureLoopTurn(loops.get(loopKey), event.channel_id, event.agent_id, event.turn, eventRunId(event))
          loops.set(loopKey, loop)
          set({ agentLoops: loops })

          const streams = new Map(state.streams)
          const stream = streams.get(loopKey)
          streams.set(loopKey, {
            agentId: event.agent_id,
            runId: eventRunId(event),
            content: stream?.content || '',
            thinking: stream?.thinking || '',
            toolCall: stream?.toolCall,
            agentLoop: loop,
          })
          set({ streams })
          break
        }

        case 'agent_progress': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const loops = new Map(state.agentLoops)
          const loopKey = eventLoopKey(event)
          const turnNumber = eventTurnNumber(event, loops.get(loopKey))
          let updated = ensureLoopTurn(loops.get(loopKey), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          updated = updateLoopTurn(updated, turnNumber, (turn) => ({
            ...turn,
            progress: event.summary,
          }))
          updated = appendLoopEvent(updated, {
            id: eventId(event, `${loopKey}:progress-${turnNumber}-${eventSeq(event) ?? Date.now()}`),
            seq: eventSeq(event),
            type: 'progress',
            turnNumber,
            timestamp: Date.now(),
            summary: event.summary,
          })
          loops.set(loopKey, updated)
          set({ agentLoops: loops })

          const streams = new Map(state.streams)
          const streamKey = eventLoopKey(event)
          const stream = streams.get(streamKey)
          if (stream) {
            streams.set(streamKey, { ...stream, agentLoop: updated })
            set({ streams })
          }

          const typing = new Map(state.typingStatus)
          typing.set(typingKey(event.channel_id, event.agent_id), event.summary)
          set({ typingStatus: typing })
          break
        }

        case 'agent_todo_snapshot':
        case 'agent_todo_updated': {
          if (shouldIgnoreStaleLiveAgentEvent(state, event)) break
          const loops = new Map(state.agentLoops)
          const loopKey = eventLoopKey(event)
          const turnNumber = eventTurnNumber(event, loops.get(loopKey))
          let updated = ensureLoopTurn(loops.get(loopKey), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          updated = applyAgentTodoEvent(updated, event.todos, event.todo)
          loops.set(loopKey, updated)
          set({ agentLoops: loops })

          const streams = new Map(state.streams)
          const stream = streams.get(loopKey)
          if (stream) {
            streams.set(loopKey, { ...stream, agentLoop: updated })
            set({ streams })
          }
          break
        }

        case 'agent_waiting_user': {
          const loopKey = eventLoopKey(event)
          const loops = new Map(state.agentLoops)
          const turnNumber = eventTurnNumber(event, loops.get(loopKey))
          let updated = ensureLoopTurn(loops.get(loopKey), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          updated = updateLoopTurn(updated, turnNumber, (turn) => ({
            ...turn,
            status: 'completed',
            progress: event.summary || turn.progress || 'Agent 正在等待用户补充信息。',
            completedAt: Date.now(),
          }))
          loops.set(loopKey, { ...updated, status: 'waiting_for_user' as const, completedAt: Date.now() })
          set({ agentLoops: loops })

          const streams = new Map(state.streams)
          streams.delete(loopKey)
          set({ streams })

          const typing = new Map(state.typingStatus)
          clearTypingForChannel(typing, event.channel_id, event.agent_id)
          set({ typingStatus: typing })
          break
        }

        case 'agent_ask_user_expired': {
          const loopKey = eventLoopKey(event)

          const streams = new Map(state.streams)
          streams.delete(loopKey)
          set({ streams })

          const loops = new Map(state.agentLoops)
          const turnNumber = eventTurnNumber(event, loops.get(loopKey))
          let updated = ensureLoopTurn(loops.get(loopKey), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          updated = updateLoopTurn(updated, turnNumber, (turn) => ({
            ...turn,
            status: 'completed',
            progress: event.summary || turn.progress || '用户未在限定时间内回答，Agent 已停止等待。',
            completedAt: Date.now(),
          }))
          loops.set(loopKey, {
            ...updated,
            status: 'waiting_expired' as const,
            error: event.summary || '等待用户回答已超时。',
            completedAt: Date.now(),
          })
          set({ agentLoops: loops })

          const typing = new Map(state.typingStatus)
          clearTypingForChannel(typing, event.channel_id, event.agent_id)
          set({ typingStatus: typing })
          break
        }

        case 'agent_done': {
          const loops = new Map(state.agentLoops)
          const loopKey = eventLoopKey(event)
          const turnNumber = eventTurnNumber(event, loops.get(loopKey))
          let updated = ensureLoopTurn(loops.get(loopKey), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          updated = updateLoopTurn(updated, turnNumber, (turn) => ({
            ...turn,
            status: 'completed',
            content: event.content,
            completedAt: Date.now(),
          }))
          updated = {
            ...updated,
            status: 'completed',
            finalContent: event.content,
            completedAt: Date.now(),
          }
          loops.set(loopKey, updated)
          set({ agentLoops: loops })

          // Clean up stream's agentLoop reference
          const streams = new Map(state.streams)
          const streamKey = eventLoopKey(event)
          streams.delete(streamKey)
          set({ streams })

          const typing = new Map(state.typingStatus)
          clearTypingForChannel(typing, event.channel_id, event.agent_id)
          set({ typingStatus: typing })
          break
        }

        case 'max_turns_reached': {
          const loops = new Map(state.agentLoops)
          const loopKey = eventLoopKey(event)
          const turnNumber = eventTurnNumber(event, loops.get(loopKey))
          let updated = ensureLoopTurn(loops.get(loopKey), event.channel_id, event.agent_id, turnNumber, eventRunId(event))
          updated = updateLoopTurn(updated, turnNumber, (turn) => ({
            ...turn,
            status: 'completed',
            completedAt: Date.now(),
          }))
          loops.set(loopKey, { ...updated, status: 'max_turns_reached' as const, completedAt: Date.now() })
          set({ agentLoops: loops })

          const streams = new Map(state.streams)
          streams.delete(loopKey)
          set({ streams })

          const typing = new Map(state.typingStatus)
          clearTypingForChannel(typing, event.channel_id, event.agent_id)
          set({ typingStatus: typing })
          break
        }

        case 'agent_stopped': {
          const loopKey = eventLoopKey(event)

          const streams = new Map(state.streams)
          streams.delete(loopKey)
          set({ streams })

          const loops = new Map(state.agentLoops)
          const loop = loops.get(loopKey)
          if (loop) {
            const turnNumber = eventTurnNumber(event, loop)
            const turns = loop.turns.map((turn) => (
              turn.turnNumber === turnNumber && turn.status === 'active'
                ? { ...turn, status: 'completed' as const, progress: event.summary || turn.progress || '任务已停止。', completedAt: Date.now() }
                : turn
            ))
            loops.set(loopKey, { ...loop, turns, status: 'stopped' as const, error: event.summary || '任务已停止。', completedAt: Date.now() })
            set({ agentLoops: loops })
          }

          const typing = new Map(state.typingStatus)
          clearTypingForChannel(typing, event.channel_id, event.agent_id)
          set({ typingStatus: typing })
          break
        }

        case 'local_agent.run.started':
        case 'local_agent.run.progress':
        case 'local_agent.run.question':
        case 'local_agent.run.artifacts.ready':
        case 'local_agent.run.artifacts.uploaded': {
          const loops = new Map(state.agentLoops)
          const target = findAgentLoopByRun(loops, event.channel_id, event.run_id, event.agent_id)
          if (!target) break

          const summary = localAgentProgressSummary(event)
          const turnNumber = eventTurnNumber({ turn: 1 }, target.loop)
          let updated = ensureLoopTurn(target.loop, event.channel_id, target.agentId, turnNumber, eventRunId(event))
          updated = updateLoopTurn(updated, turnNumber, (turn) => ({
            ...turn,
            progress: summary,
          }))
          updated = appendLoopEvent(updated, {
            id: eventId(event, `${target.key}:${event.type}-${eventSeq(event) ?? Date.now()}`),
            seq: eventSeq(event),
            type: 'progress',
            turnNumber,
            timestamp: Date.now(),
            summary,
          })
          loops.set(target.key, updated)
          set({ agentLoops: loops })

          const streams = new Map(state.streams)
          const stream = streams.get(target.key)
          if (stream) {
            streams.set(target.key, { ...stream, agentLoop: updated })
            set({ streams })
          }

          const typing = new Map(state.typingStatus)
          typing.set(typingKey(event.channel_id, target.agentId), summary)
          set({ typingStatus: typing })
          break
        }

        case 'local_agent.run.succeeded':
        case 'local_agent.run.failed': {
          const loops = new Map(state.agentLoops)
          const target = findAgentLoopByRun(loops, event.channel_id, event.run_id, event.agent_id)
          if (!target) break

          const summary = localAgentRunSummary(event)
          const turnNumber = eventTurnNumber({ turn: 1 }, target.loop)
          let updated = ensureLoopTurn(target.loop, event.channel_id, target.agentId, turnNumber, eventRunId(event))
          updated = updateLoopTurn(updated, turnNumber, (turn) => ({
            ...turn,
            status: 'completed',
            progress: summary,
            completedAt: Date.now(),
          }))
          updated = appendLoopEvent(updated, {
            id: eventId(event, `${target.key}:${event.type}-${eventSeq(event) ?? Date.now()}`),
            seq: eventSeq(event),
            type: 'progress',
            turnNumber,
            timestamp: Date.now(),
            summary,
          })
          loops.set(target.key, {
            ...updated,
            status: event.type === 'local_agent.run.succeeded' ? 'completed' : 'error',
            finalContent: event.type === 'local_agent.run.succeeded' ? summary : updated.finalContent,
            error: event.type === 'local_agent.run.failed' ? summary : undefined,
            completedAt: Date.now(),
          })
          set({ agentLoops: loops })

          const streams = new Map(state.streams)
          streams.delete(target.key)
          set({ streams })

          const typing = new Map(state.typingStatus)
          clearTypingForChannel(typing, event.channel_id, target.agentId)
          set({ typingStatus: typing })
          break
        }

        case 'error': {
          if (event.channel_id) {
            const typing = new Map(state.typingStatus)
            clearTypingForChannel(typing, event.channel_id, event.agent_id)
            set({ typingStatus: typing })

            if (event.agent_id) {
              const loopKey = agentLoopStoreKey(event.channel_id, event.agent_id, eventRunId(event))
              const loops = new Map(state.agentLoops)
              const loop = loops.get(loopKey)
              if (loop && loop.status === 'running') {
                const turnNumber = eventTurnNumber(event, loop)
                const turns = loop.turns.map((turn) => (
                  turn.turnNumber === turnNumber
                    ? { ...turn, status: 'completed' as const, completedAt: Date.now() }
                    : turn
                ))
                loops.set(loopKey, { ...loop, turns, status: 'error', error: event.error, completedAt: Date.now() })
                set({ agentLoops: loops })
              }

              const streams = new Map(state.streams)
              streams.delete(loopKey)
              set({ streams })
            }
          }
          break
        }
      }
    },

    submitAskUserAnswer: (channelId, askId, answers) => {
      config.sendWsCommand({
        type: 'ask_user_answer',
        channel_id: channelId,
        ask_id: askId,
        answers,
      })

      // Mark message as answered locally
      const map = new Map(get().messages)
      const msgs = map.get(channelId)
      if (msgs) {
        const updated = msgs.map((m) => {
          if (m.askUserData?.askId === askId) {
            return { ...m, askUserData: { ...m.askUserData, status: 'answered' as const, answers } }
          }
          return m
        })
        map.set(channelId, updated)
        set({ messages: map })
      }
    },

    getMessages: (channelId) => get().messages.get(channelId) || [],

    getStreams: (channelId) => {
      const streams = [...get().streams.entries()]
        .filter(([key]) => key.startsWith(`${channelId}:`))
        .map(([, stream]) => stream)
      streams.sort((a, b) => streamActivityAt(a) - streamActivityAt(b))
      return streams
    },

    getStream: (channelId) => {
      const streams = get().getStreams(channelId)
      return streams[streams.length - 1]
    },

    getAgentLoops: (channelId) => {
      const loops = [...get().agentLoops.entries()]
        .filter(([key]) => key.startsWith(`${channelId}:`))
        .map(([, loop]) => loop)
      loops.sort((a, b) => {
        return agentLoopActivityAt(b) - agentLoopActivityAt(a)
      })
      return loops
    },

    getAgentLoop: (channelId) => {
      const loops = get().getAgentLoops(channelId)
      loops.sort((a, b) => {
        const aRunning = a.status === 'running' || a.status === 'waiting_for_user'
        const bRunning = b.status === 'running' || b.status === 'waiting_for_user'
        if (aRunning !== bRunning) return aRunning ? -1 : 1
        return agentLoopActivityAt(b) - agentLoopActivityAt(a)
      })
      return loops[0]
    },

    getMembers: (channelId) => get().members.get(channelId) || [],

    getTypings: (channelId) => {
      const direct = get().typingStatus.get(channelId)
      const values = [...get().typingStatus.entries()]
        .filter(([key]) => key.startsWith(`${channelId}:`))
        .map(([, value]) => value)
      return direct ? [direct, ...values] : values
    },

    getTyping: (channelId) => get().getTypings(channelId)[0] || '',

    reset: () => set({
      messages: new Map(),
      streams: new Map(),
      agentLoops: new Map(),
      members: new Map(),
      typingStatus: new Map(),
      loadingChannel: null,
    }),
  }))
}

export type MessagesStore = ReturnType<typeof createMessagesStore>
