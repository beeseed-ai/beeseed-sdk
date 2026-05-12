import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { RoomWithMeta, RoomMember } from '../core/types.js'

export interface RoomsState {
  rooms: RoomWithMeta[]
  currentRoomId: string | null
  loading: boolean

  fetchRooms: () => Promise<void>
  setCurrentRoom: (roomId: string | null) => void
  setRooms: (rooms: RoomWithMeta[]) => void
  createRoom: (name: string, agentIds: string[]) => Promise<{ room: RoomWithMeta; members: RoomMember[] } | null>
  updateUnread: (roomId: string, count: number) => void
  reset: () => void
}

export interface RoomsStoreConfig {
  api: KyInstance
}

export function createRoomsStore(config: RoomsStoreConfig) {
  return createStore<RoomsState>()((set, get) => ({
    rooms: [],
    currentRoomId: (() => { try { return sessionStorage.getItem('beeseed_current_room') } catch { return null } })(),
    loading: false,

    fetchRooms: async () => {
      set({ loading: true })
      try {
        const rooms = await config.api.get('rooms').json<RoomWithMeta[]>()
        set({ rooms, loading: false })
      } catch {
        set({ loading: false })
      }
    },

    setCurrentRoom: (roomId) => {
      try { if (roomId) sessionStorage.setItem('beeseed_current_room', roomId); else sessionStorage.removeItem('beeseed_current_room') } catch {}
      set({ currentRoomId: roomId })
    },

    setRooms: (rooms) => set({ rooms }),

    createRoom: async (name, agentIds) => {
      try {
        const data = await config.api.post('rooms', {
          json: { name, agent_ids: agentIds },
        }).json<{ room: RoomWithMeta; members: RoomMember[] }>()
        set({ rooms: [data.room, ...get().rooms] })
        return data
      } catch {
        return null
      }
    },

    updateUnread: (roomId, count) => {
      set({
        rooms: get().rooms.map((r) =>
          r.id === roomId ? { ...r, unread_count: count } : r,
        ),
      })
    },

    reset: () => set({ rooms: [], currentRoomId: null, loading: false }),
  }))
}

export type RoomsStore = ReturnType<typeof createRoomsStore>
