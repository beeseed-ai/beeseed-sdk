import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { Message, StreamState, WSEvent } from '../core/types.js'

export interface MessagesState {
  messages: Map<string, Message[]>
  streams: Map<string, StreamState>
  typingStatus: Map<string, string>
  loadingRoom: string | null

  fetchMessages: (roomId: string) => Promise<void>
  handleEvent: (event: WSEvent) => void
  getMessages: (roomId: string) => Message[]
  getStream: (roomId: string) => StreamState | undefined
  getTyping: (roomId: string) => string
  reset: () => void
}

export interface MessagesStoreConfig {
  api: KyInstance
  getCurrentRoomId: () => string | null
}

export function createMessagesStore(config: MessagesStoreConfig) {
  return createStore<MessagesState>()((set, get) => ({
    messages: new Map(),
    streams: new Map(),
    typingStatus: new Map(),
    loadingRoom: null,

    fetchMessages: async (roomId) => {
      set({ loadingRoom: roomId })
      try {
        const msgs = await config.api.get(`rooms/${roomId}/messages`).json<Message[]>()
        const map = new Map(get().messages)
        map.set(roomId, msgs)
        set({ messages: map, loadingRoom: null })
      } catch {
        set({ loadingRoom: null })
      }
    },

    handleEvent: (event) => {
      const state = get()

      switch (event.type) {
        case 'message': {
          const map = new Map(state.messages)
          const msgs = [...(map.get(event.room_id) || [])]
          if (!msgs.some((m) => m.id === event.message.id)) {
            msgs.push(event.message)
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
          })
          set({ streams })
          break
        }

        case 'message_end': {
          const streams = new Map(state.streams)
          streams.delete(`${event.room_id}:${event.agent_id}`)
          set({ streams })

          if (event.message) {
            const map = new Map(state.messages)
            const msgs = [...(map.get(event.room_id) || [])]
            if (!msgs.some((m) => m.id === event.message.id)) {
              msgs.push(event.message)
              map.set(event.room_id, msgs)
              set({ messages: map })
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
          streams.set(key, {
            agentId: event.agent_id,
            content: existing?.content || '',
            thinking: existing?.thinking || '',
            toolCall: { name: event.name, args: event.args },
          })
          set({ streams })

          const typing = new Map(state.typingStatus)
          typing.set(event.room_id, `${event.agent_id} 调用工具 ${event.name}...`)
          set({ typingStatus: typing })
          break
        }

        case 'tool_result': {
          const typing = new Map(state.typingStatus)
          typing.set(event.room_id, `${event.agent_id} 正在思考...`)
          set({ typingStatus: typing })
          break
        }

        case 'error': {
          if (event.room_id) {
            const typing = new Map(state.typingStatus)
            typing.delete(event.room_id)
            set({ typingStatus: typing })
          }
          break
        }
      }
    },

    getMessages: (roomId) => get().messages.get(roomId) || [],

    getStream: (roomId) => {
      for (const [key, stream] of get().streams) {
        if (key.startsWith(`${roomId}:`)) return stream
      }
      return undefined
    },

    getTyping: (roomId) => get().typingStatus.get(roomId) || '',

    reset: () => set({
      messages: new Map(),
      streams: new Map(),
      typingStatus: new Map(),
      loadingRoom: null,
    }),
  }))
}

export type MessagesStore = ReturnType<typeof createMessagesStore>
