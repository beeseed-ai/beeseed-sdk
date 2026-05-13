import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type {
  Message, ChatMessage, StreamState, WSEvent,
  RoomMemberInfo, AgentLoopState, AgentLoopTurn, AgentLoopToolCall,
  AskUserQuestion,
} from '../core/types.js'

const AGENT_LOOP_STALE_AFTER_MS = 30 * 60 * 1000

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
        senderType: m.sender_type === 'agent' ? 'agent' : undefined,
        askUserData: {
          questions: meta.questions as AskUserQuestion[],
          status: getAskUserStatus(meta),
          answers: meta.answers as Record<string, unknown> | undefined,
          askId: (meta._ask_id as string) || undefined,
          targetUserId: (meta.target_user_id as string) || undefined,
          targetUserIds: Array.isArray(meta.target_user_ids) ? meta.target_user_ids as string[] : undefined,
          visibility: (meta.visibility as 'target_user' | 'target_users' | 'mentioned_users' | 'room_admins' | 'all_members') || undefined,
          expiresAt: (meta.expires_at as string) || undefined,
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
    contentType: m.msg_type !== 'text' ? m.msg_type : undefined,
    suggestions: Array.isArray(meta.suggestions) ? meta.suggestions as string[] : undefined,
    thinkingContent: (meta.thinking_content as string) || undefined,
    routingInfo: meta.routing_info ? {
      targets: ((meta.routing_info as Record<string, unknown>).target_agent_ids as string[]) ?? [],
      method: ((meta.routing_info as Record<string, unknown>).routing_method as string) ?? '',
    } : undefined,
  }
}

function buildAgentLoopsFromMessages(roomId: string, messages: Message[]): Map<string, AgentLoopState> {
  const loops = new Map<string, AgentLoopState>()
  const latestEventAt = new Map<string, number>()
  const expiredAskAt = new Map<string, number>()

  for (const message of messages) {
    const agentId = message.sender_agent_id
    if (!agentId) continue

    const key = `${roomId}:${agentId}`
    const meta = (message.metadata ?? {}) as Record<string, unknown>
    const timestamp = new Date(message.created_at).getTime()

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
        agentId,
        roomId,
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
        status: 'active',
        startedAt: timestamp,
      }
      loop = { ...loop, turns: [...loop.turns, turn], currentTurn: turnNumber }
      loops.set(key, loop)
    }

    if (message.msg_type === 'thinking') {
      turn = { ...turn, progress: message.content }
    } else if (message.msg_type === 'tool_call') {
      const tool: AgentLoopToolCall = {
        id: `${message.id}`,
        name: (meta.name as string) || 'unknown',
        args: meta.args as Record<string, unknown> | undefined,
        status: 'calling',
        startedAt: timestamp,
        parallel: Boolean(meta.parallel),
        batchId: meta.batch_id as string | undefined,
      }
      turn = { ...turn, toolCalls: [...turn.toolCalls, tool] }
    } else if (message.msg_type === 'tool_result') {
      const name = (meta.name as string) || 'unknown'
      const idx = [...turn.toolCalls].reverse().findIndex((tc) => tc.name === name && tc.status === 'calling')
      if (idx >= 0) {
        const realIdx = turn.toolCalls.length - 1 - idx
        const updated = {
          ...turn.toolCalls[realIdx]!,
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
      } else {
        turn = {
          ...turn,
          toolCalls: [
            ...turn.toolCalls,
            {
              id: `${message.id}`,
              name,
              status: meta.success !== false ? 'success' : 'failed',
              output: (meta.output as string) || message.content,
              startedAt: timestamp,
              completedAt: timestamp,
            },
          ],
        }
      }
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
        ? { ...turn, status: 'completed' as const, progress: turn.progress || '任务已中断。', completedAt: latestAt }
        : turn
    ))
    loops.set(key, {
      ...loop,
      turns,
      status: 'interrupted',
      completedAt: latestAt,
      error: '任务已中断。',
    })
  }

  return loops
}

// ── Store ──

export interface MessagesState {
  messages: Map<string, ChatMessage[]>
  streams: Map<string, StreamState>
  agentLoops: Map<string, AgentLoopState>
  members: Map<string, RoomMemberInfo[]>
  typingStatus: Map<string, string>
  loadingRoom: string | null

  fetchMessages: (roomId: string) => Promise<void>
  fetchMembers: (roomId: string) => Promise<void>
  handleEvent: (event: WSEvent) => void
  addOptimisticMessage: (roomId: string, content: string) => void
  submitAskUserAnswer: (roomId: string, askId: string, answers: Record<string, unknown>) => void
  getMessages: (roomId: string) => ChatMessage[]
  getStream: (roomId: string) => StreamState | undefined
  getAgentLoop: (roomId: string) => AgentLoopState | undefined
  getMembers: (roomId: string) => RoomMemberInfo[]
  getTyping: (roomId: string) => string
  reset: () => void
}

export interface MessagesStoreConfig {
  api: KyInstance
  getCurrentRoomId: () => string | null
  getCurrentUserId: () => string | undefined
  sendWsCommand: (cmd: unknown) => void
}

export function createMessagesStore(config: MessagesStoreConfig) {
  return createStore<MessagesState>()((set, get) => ({
    messages: new Map(),
    streams: new Map(),
    agentLoops: new Map(),
    members: new Map(),
    typingStatus: new Map(),
    loadingRoom: null,

    fetchMessages: async (roomId) => {
      set({ loadingRoom: roomId })
      try {
        const msgs = await config.api.get(`rooms/${roomId}/messages`).json<Message[]>()
        const userId = config.getCurrentUserId()
        const parsed = msgs
          .map((m) => parseMessage(m, userId))
          .filter((m): m is ChatMessage => m !== null)
        const map = new Map(get().messages)
        map.set(roomId, parsed)
        const loops = new Map(get().agentLoops)
        for (const key of loops.keys()) {
          if (key.startsWith(`${roomId}:`)) {
            loops.delete(key)
          }
        }
        for (const [key, loop] of buildAgentLoopsFromMessages(roomId, msgs)) {
          loops.set(key, loop)
        }
        set({ messages: map, agentLoops: loops, loadingRoom: null })
      } catch {
        set({ loadingRoom: null })
      }
    },

    fetchMembers: async (roomId) => {
      try {
        const raw = await config.api.get(`rooms/${roomId}/members`).json<RoomMemberInfo[]>()
        const data = raw
          .map((m) => ({
            ...m,
            display_name: m.display_name || m.nickname || m.agent_id || m.user_id || 'unknown',
          }))
        const map = new Map(get().members)
        map.set(roomId, data)
        set({ members: map })
      } catch {
        // ignore
      }
    },

    addOptimisticMessage: (roomId, content) => {
      const map = new Map(get().messages)
      const msgs = [...(map.get(roomId) || [])]
      msgs.push({
        role: 'user',
        content,
        timestamp: Date.now(),
        senderType: 'user',
      })
      map.set(roomId, msgs)
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
          let msgs = [...(map.get(event.room_id) || [])]
          const existingIdx = msgs.findIndex((m) => m.msgId === parsed.msgId)
          if (existingIdx >= 0) {
            msgs[existingIdx] = parsed
            map.set(event.room_id, msgs)
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
          map.set(event.room_id, msgs)
          set({ messages: map })
          break
        }

        case 'routing_info': {
          if (!event.routing_info) break
          const ri = event.routing_info as { routing_method: string; target_agent_ids: string[]; reason: string }
          const map = new Map(state.messages)
          const msgs = [...(map.get(event.room_id) || [])]
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'user') {
              msgs[i] = { ...msgs[i], routingInfo: { targets: ri.target_agent_ids, method: ri.routing_method } }
              break
            }
          }
          map.set(event.room_id, msgs)
          set({ messages: map })
          break
        }

        case 'typing': {
          const typing = new Map(state.typingStatus)
          typing.set(event.room_id, `${event.agent_id || 'Agent'} 正在输入...`)
          set({ typingStatus: typing })
          break
        }

        case 'chunk': {
          const streams = new Map(state.streams)
          const key = `${event.room_id}:${event.agent_id}`
          const existing = streams.get(key)
          streams.set(key, {
            agentId: event.agent_id,
            content: (existing?.content || '') + event.content,
            thinking: existing?.thinking || '',
            agentLoop: existing?.agentLoop,
          })
          set({ streams })
          break
        }

        case 'thinking': {
          const streams = new Map(state.streams)
          const key = `${event.room_id}:${event.agent_id}`
          const existing = streams.get(key)
          streams.set(key, {
            agentId: event.agent_id,
            content: existing?.content || '',
            thinking: (existing?.thinking || '') + event.content,
            agentLoop: existing?.agentLoop,
          })
          set({ streams })
          break
        }

        case 'thinking_content': {
          const streams = new Map(state.streams)
          const key = `${event.room_id}:${event.agent_id}`
          const existing = streams.get(key)
          streams.set(key, {
            agentId: event.agent_id,
            content: existing?.content || '',
            thinking: (existing?.thinking || '') + event.content,
            agentLoop: existing?.agentLoop,
          })
          set({ streams })
          break
        }

        case 'message_end': {
          const streams = new Map(state.streams)
          const streamKey = `${event.room_id}:${event.agent_id}`
          streams.delete(streamKey)
          set({ streams })

          if (event.message) {
            const parsed = parseMessage(event.message, userId)
            if (parsed) {
              const map = new Map(state.messages)
              const msgs = [...(map.get(event.room_id) || [])]
              if (!msgs.some((m) => m.msgId === parsed.msgId)) {
                msgs.push(parsed)
                map.set(event.room_id, msgs)
                set({ messages: map })
              }
            }
          }

          const typing = new Map(state.typingStatus)
          typing.delete(event.room_id)
          set({ typingStatus: typing })
          break
        }

        case 'tool_call': {
          const streams = new Map(state.streams)
          const key = `${event.room_id}:${event.agent_id}`
          const existing = streams.get(key)
          const newStream: StreamState = {
            agentId: event.agent_id,
            content: existing?.content || '',
            thinking: existing?.thinking || '',
            toolCall: { name: event.name, args: event.args },
            agentLoop: existing?.agentLoop,
          }

          // Update agent loop if active
          if (newStream.agentLoop) {
            const loop = { ...newStream.agentLoop }
            const turn = loop.turns[loop.turns.length - 1]
            if (turn && turn.status === 'active') {
              const toolCall: AgentLoopToolCall = {
                id: `${event.name}-${Date.now()}`,
                name: event.name,
                args: event.args as Record<string, unknown>,
                status: 'calling',
                startedAt: Date.now(),
                parallel: (event as { parallel?: boolean }).parallel,
                batchId: (event as { batch_id?: string }).batch_id,
              }
              turn.toolCalls = [...turn.toolCalls, toolCall]
              loop.turns = [...loop.turns.slice(0, -1), { ...turn }]
              newStream.agentLoop = loop
            }
          }

          streams.set(key, newStream)
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.set(event.room_id, `${event.agent_id} 调用工具 ${event.name}...`)
          set({ typingStatus: typing })
          break
        }

        case 'tool_result': {
          const streams = new Map(state.streams)
          const key = `${event.room_id}:${event.agent_id}`
          const existing = streams.get(key)

          if (existing?.agentLoop) {
            const loop = { ...existing.agentLoop }
            const turn = loop.turns[loop.turns.length - 1]
            if (turn) {
              const idx = [...turn.toolCalls].reverse().findIndex(
                (tc) => tc.name === event.name && tc.status === 'calling',
              )
              if (idx >= 0) {
                const realIdx = turn.toolCalls.length - 1 - idx
                const updated = { ...turn.toolCalls[realIdx]! }
                updated.status = event.success !== false ? 'success' : 'failed'
                updated.output = event.output
                updated.completedAt = Date.now()
                turn.toolCalls = [
                  ...turn.toolCalls.slice(0, realIdx),
                  updated,
                  ...turn.toolCalls.slice(realIdx + 1),
                ]
                loop.turns = [...loop.turns.slice(0, -1), { ...turn }]
              }
            }
            streams.set(key, { ...existing, agentLoop: loop, toolCall: undefined })
            set({ streams })
          }

          const typing = new Map(state.typingStatus)
          typing.set(event.room_id, `${event.agent_id} 正在思考...`)
          set({ typingStatus: typing })
          break
        }

        // ── Agent Loop events ──

        case 'agent_ack': {
          const loops = new Map(state.agentLoops)
          const loopKey = `${event.room_id}:${event.agent_id}`
          const existing = loops.get(loopKey)
          const turnNumber = existing && event.turn <= existing.currentTurn
            ? existing.currentTurn + 1
            : event.turn

          const newTurn: AgentLoopTurn = {
            turnNumber,
            toolCalls: [],
            status: 'active',
            startedAt: Date.now(),
          }

          const loop: AgentLoopState = existing
            ? {
                ...existing,
                status: 'running',
                currentTurn: turnNumber,
                turns: [...existing.turns, newTurn],
                completedAt: undefined,
                error: undefined,
              }
            : {
                agentId: event.agent_id,
                roomId: event.room_id,
                turns: [newTurn],
                status: 'running',
                currentTurn: turnNumber,
                startedAt: Date.now(),
              }

          loops.set(loopKey, loop)
          set({ agentLoops: loops })

          // Attach to stream
          const streams = new Map(state.streams)
          const streamKey = `${event.room_id}:${event.agent_id}`
          const stream = streams.get(streamKey)
          streams.set(streamKey, {
            agentId: event.agent_id,
            content: stream?.content || '',
            thinking: stream?.thinking || '',
            toolCall: stream?.toolCall,
            agentLoop: loop,
          })
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.set(event.room_id, `${event.agent_id} 开始第 ${event.turn} 轮...`)
          set({ typingStatus: typing })
          break
        }

        case 'agent_thinking': {
          const loops = new Map(state.agentLoops)
          const loopKey = `${event.room_id}:${event.agent_id}`
          const loop = loops.get(loopKey)
          if (loop) {
            const updated = { ...loop }
            const turn = updated.turns[updated.turns.length - 1]
            if (turn) {
              turn.thinking = (turn.thinking || '') + (event.content || '')
              updated.turns = [...updated.turns.slice(0, -1), { ...turn }]
            }
            loops.set(loopKey, updated)
            set({ agentLoops: loops })

            // Sync to stream
            const streams = new Map(state.streams)
            const streamKey = `${event.room_id}:${event.agent_id}`
            const stream = streams.get(streamKey)
            if (stream) {
              streams.set(streamKey, { ...stream, agentLoop: updated })
              set({ streams })
            }
          }
          break
        }

        case 'agent_progress': {
          const loops = new Map(state.agentLoops)
          const loopKey = `${event.room_id}:${event.agent_id}`
          const loop = loops.get(loopKey)
          if (loop) {
            const updated = { ...loop }
            const turn = updated.turns[updated.turns.length - 1]
            if (turn) {
              turn.progress = event.summary
              updated.turns = [...updated.turns.slice(0, -1), { ...turn }]
            }
            loops.set(loopKey, updated)
            set({ agentLoops: loops })

            const streams = new Map(state.streams)
            const streamKey = `${event.room_id}:${event.agent_id}`
            const stream = streams.get(streamKey)
            if (stream) {
              streams.set(streamKey, { ...stream, agentLoop: updated })
              set({ streams })
            }
          }

          const typing = new Map(state.typingStatus)
          typing.set(event.room_id, event.summary)
          set({ typingStatus: typing })
          break
        }

        case 'agent_waiting_user': {
          const loopKey = `${event.room_id}:${event.agent_id}`
          const loops = new Map(state.agentLoops)
          const loop = loops.get(loopKey)
          if (loop) {
            const turns = loop.turns.map((turn, index) => (
              index === loop.turns.length - 1
                ? {
                    ...turn,
                    status: 'completed' as const,
                    progress: event.summary || turn.progress || 'Agent 正在等待用户补充信息。',
                    completedAt: Date.now(),
                  }
                : turn
            ))
            loops.set(loopKey, { ...loop, turns, status: 'waiting_for_user' as const, completedAt: Date.now() })
            set({ agentLoops: loops })
          }

          const streams = new Map(state.streams)
          streams.delete(loopKey)
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.delete(event.room_id)
          set({ typingStatus: typing })
          break
        }

        case 'agent_ask_user_expired': {
          const loopKey = `${event.room_id}:${event.agent_id}`

          const streams = new Map(state.streams)
          streams.delete(loopKey)
          set({ streams })

          const loops = new Map(state.agentLoops)
          const loop = loops.get(loopKey)
          if (loop) {
            const turns = loop.turns.map((turn, index) => (
              index === loop.turns.length - 1
                ? {
                    ...turn,
                    status: 'completed' as const,
                    progress: event.summary || turn.progress || '用户未在限定时间内回答，Agent 已停止等待。',
                    completedAt: Date.now(),
                  }
                : turn
            ))
            loops.set(loopKey, {
              ...loop,
              turns,
              status: 'waiting_expired' as const,
              error: event.summary || '等待用户回答已超时。',
              completedAt: Date.now(),
            })
            set({ agentLoops: loops })
          }

          const typing = new Map(state.typingStatus)
          typing.delete(event.room_id)
          set({ typingStatus: typing })
          break
        }

        case 'agent_done': {
          const loops = new Map(state.agentLoops)
          const loopKey = `${event.room_id}:${event.agent_id}`
          const loop = loops.get(loopKey)
          if (loop) {
            const updated = { ...loop }
            const turn = updated.turns[updated.turns.length - 1]
            if (turn) {
              turn.status = 'completed'
              turn.content = event.content
              turn.completedAt = Date.now()
              updated.turns = [...updated.turns.slice(0, -1), { ...turn }]
            }
            updated.status = 'completed'
            updated.finalContent = event.content
            updated.completedAt = Date.now()
            loops.set(loopKey, updated)
            set({ agentLoops: loops })
          }

          // Clean up stream's agentLoop reference
          const streams = new Map(state.streams)
          const streamKey = `${event.room_id}:${event.agent_id}`
          streams.delete(streamKey)
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.delete(event.room_id)
          set({ typingStatus: typing })
          break
        }

        case 'max_turns_reached': {
          const loops = new Map(state.agentLoops)
          const loopKey = `${event.room_id}:${event.agent_id}`
          const loop = loops.get(loopKey)
          if (loop) {
            const updated = { ...loop, status: 'max_turns_reached' as const, completedAt: Date.now() }
            loops.set(loopKey, updated)
            set({ agentLoops: loops })
          }

          const streams = new Map(state.streams)
          streams.delete(`${event.room_id}:${event.agent_id}`)
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.delete(event.room_id)
          set({ typingStatus: typing })
          break
        }

        case 'agent_stopped': {
          const loopKey = `${event.room_id}:${event.agent_id}`

          const streams = new Map(state.streams)
          streams.delete(loopKey)
          set({ streams })

          const loops = new Map(state.agentLoops)
          const loop = loops.get(loopKey)
          if (loop) {
            const turns = loop.turns.map((turn, index) => (
              index === loop.turns.length - 1 && turn.status === 'active'
                ? { ...turn, status: 'completed' as const, progress: turn.progress || '任务已停止。', completedAt: Date.now() }
                : turn
            ))
            loops.set(loopKey, { ...loop, turns, status: 'stopped' as const, completedAt: Date.now() })
            set({ agentLoops: loops })
          }

          const typing = new Map(state.typingStatus)
          typing.delete(event.room_id)
          set({ typingStatus: typing })
          break
        }

        case 'error': {
          if (event.room_id) {
            const typing = new Map(state.typingStatus)
            typing.delete(event.room_id)
            set({ typingStatus: typing })

            if (event.agent_id) {
              const loopKey = `${event.room_id}:${event.agent_id}`
              const loops = new Map(state.agentLoops)
              const loop = loops.get(loopKey)
              if (loop && loop.status === 'running') {
                loops.set(loopKey, { ...loop, status: 'error', error: event.error, completedAt: Date.now() })
                set({ agentLoops: loops })
              }

              const streams = new Map(state.streams)
              streams.delete(`${event.room_id}:${event.agent_id}`)
              set({ streams })
            }
          }
          break
        }
      }
    },

    submitAskUserAnswer: (roomId, askId, answers) => {
      config.sendWsCommand({
        type: 'ask_user_answer',
        room_id: roomId,
        ask_id: askId,
        answers,
      })

      // Mark message as answered locally
      const map = new Map(get().messages)
      const msgs = map.get(roomId)
      if (msgs) {
        const updated = msgs.map((m) => {
          if (m.askUserData?.askId === askId) {
            return { ...m, askUserData: { ...m.askUserData, status: 'answered' as const, answers } }
          }
          return m
        })
        map.set(roomId, updated)
        set({ messages: map })
      }
    },

    getMessages: (roomId) => get().messages.get(roomId) || [],

    getStream: (roomId) => {
      for (const [key, stream] of get().streams) {
        if (key.startsWith(`${roomId}:`)) return stream
      }
      return undefined
    },

    getAgentLoop: (roomId) => {
      for (const [key, loop] of get().agentLoops) {
        if (key.startsWith(`${roomId}:`)) return loop
      }
      return undefined
    },

    getMembers: (roomId) => get().members.get(roomId) || [],

    getTyping: (roomId) => get().typingStatus.get(roomId) || '',

    reset: () => set({
      messages: new Map(),
      streams: new Map(),
      agentLoops: new Map(),
      members: new Map(),
      typingStatus: new Map(),
      loadingRoom: null,
    }),
  }))
}

export type MessagesStore = ReturnType<typeof createMessagesStore>
