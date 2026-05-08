import { createStore } from 'zustand/vanilla'
import type { ConnectionState } from '../core/ws.js'

export interface ConnectionStoreState {
  state: ConnectionState
  reconnectAttempt: number

  setState: (state: ConnectionState) => void
  incrementAttempt: () => void
  resetAttempt: () => void
}

export function createConnectionStore() {
  return createStore<ConnectionStoreState>()((set) => ({
    state: 'disconnected',
    reconnectAttempt: 0,

    setState: (state) => {
      set({ state })
      if (state === 'connected') set({ reconnectAttempt: 0 })
    },

    incrementAttempt: () => set((s) => ({ reconnectAttempt: s.reconnectAttempt + 1 })),

    resetAttempt: () => set({ reconnectAttempt: 0 }),
  }))
}

export type ConnectionStore = ReturnType<typeof createConnectionStore>
