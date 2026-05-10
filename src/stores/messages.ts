import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type {
  Message, ChatMessage, StreamState, WSEvent, RoomMember,
  RoomMemberInfo, AgentLoopState, AgentLoopTurn, AgentLoopToolCall,
  AskUserQuestion,
} from '../core/types.js'

// ── Message parsing (wire Message → display ChatMessage) ──

export function parseMessage(m: Message, myUserId?: string): ChatMessage | null {
  const meta = (m.metadata ?? {}) as Record<string, unknown>

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
          status: meta.ask_user_status === 'answered' ? 'answered' : 'pending',
          answers: meta.answers as Record<string, unknown> | undefined,
          askId: (meta._ask_id as string) || undefined,
          targetUserId: (meta.target_user_id as string) || undefined,
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
  }
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
        set({ messages: map, loadingRoom: null })
      } catch {
        set({ loadingRoom: null })
      }
    },

    fetchMembers: async (roomId) => {
      try {
        const raw = await config.api.get(`rooms/${roomId}/members`).json<RoomMember[]>()
        const data: RoomMemberInfo[] = raw.map((m) => ({
          ...m,
          display_name: m.nickname || m.agent_id || m.user_id || 'unknown',
        }))
        const map = new Map(get().members)
        map.set(roomId, data)
        set({ members: map })
      } catch {
        // ignore
      }
    },

    handleEvent: (event) => {
      const state = get()
      const userId = config.getCurrentUserId()

      switch (event.type) {
        case 'message': {
          const parsed = parseMessage(event.message, userId)
          if (!parsed) break
          const map = new Map(state.messages)
          const msgs = [...(map.get(event.room_id) || [])]
          if (!msgs.some((m) => m.msgId === parsed.msgId)) {
            msgs.push(parsed)
            map.set(event.room_id, msgs)
            set({ messages: map })
          }
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

          const typing = new Map(state.typingStatus)
          typing.set(event.room_id, `${event.agent_id} 正在输入...`)
          set({ typingStatus: typing })
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

          const newTurn: AgentLoopTurn = {
            turnNumber: event.turn,
            toolCalls: [],
            status: 'active',
            startedAt: Date.now(),
          }

          const loop: AgentLoopState = existing
            ? { ...existing, currentTurn: event.turn, turns: [...existing.turns, newTurn] }
            : {
                agentId: event.agent_id,
                roomId: event.room_id,
                turns: [newTurn],
                status: 'running',
                currentTurn: event.turn,
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
