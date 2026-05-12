import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { AppUser, AppRole } from '../core/types.js'
import { MOCK_APP_USERS } from '../mocks/app-users.js'

export interface AppUsersState {
  users: AppUser[]
  loading: boolean

  fetchUsers: () => Promise<void>
  changeRole: (userId: string, role: AppRole) => Promise<void>
  toggleDisabled: (userId: string, disabled: boolean) => Promise<void>
}

export interface AppUsersStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createAppUsersStore(config: AppUsersStoreConfig) {
  return createStore<AppUsersState>()((set, get) => ({
    users: [],
    loading: false,

    fetchUsers: async () => {
      set({ loading: true })
      if (config.useMock) {
        setTimeout(() => {
          set({ users: MOCK_APP_USERS, loading: false })
        }, 500)
        return
      }
      try {
        const data = await config.api.get('admin/users').json<{ total: number; items: AppUser[] }>()
        set({ users: Array.isArray(data?.items) ? data.items : [], loading: false })
      } catch {
        set({ loading: false })
      }
    },

    changeRole: async (userId, role) => {
      if (config.useMock) {
        set({ users: get().users.map(u => u.id === userId ? { ...u, role } : u) })
        return
      }
      try {
        await config.api.patch(`admin/users/${userId}/role`, { json: { role } })
        set({ users: get().users.map(u => u.id === userId ? { ...u, role } : u) })
      } catch { /* */ }
    },

    toggleDisabled: async (userId, disabled) => {
      if (config.useMock) {
        set({ users: get().users.map(u => u.id === userId ? { ...u, is_disabled: disabled } : u) })
        return
      }
      try {
        await config.api.patch(`admin/users/${userId}/disabled`, { json: { is_disabled: disabled } })
        set({ users: get().users.map(u => u.id === userId ? { ...u, is_disabled: disabled } : u) })
      } catch { /* */ }
    }
  }))
}

export type AppUsersStore = ReturnType<typeof createAppUsersStore>