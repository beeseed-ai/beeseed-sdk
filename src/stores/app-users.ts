import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { AppMemberBlock, AppUser, AppRole } from '../core/types.js'
import { MOCK_APP_USERS } from '../mocks/app-users.js'

export interface AppUsersState {
  users: AppUser[]
  blockedUsers: AppMemberBlock[]
  blockedTotal: number
  loading: boolean
  blockedLoading: boolean
  error: string | null

  fetchUsers: () => Promise<void>
  fetchBlockedUsers: (params?: { limit?: number; offset?: number }) => Promise<void>
  changeRole: (userId: string, role: AppRole) => Promise<void>
  toggleDisabled: (userId: string, disabled: boolean) => Promise<void>
  removeUser: (userId: string) => Promise<void>
  blockUser: (userId: string, reason?: string) => Promise<void>
  unblockUser: (appUserId: string) => Promise<void>
}

export interface AppUsersStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createAppUsersStore(config: AppUsersStoreConfig) {
  return createStore<AppUsersState>()((set, get) => ({
    users: [],
    blockedUsers: [],
    blockedTotal: 0,
    loading: false,
    blockedLoading: false,
    error: null,

    fetchUsers: async () => {
      set({ loading: true, error: null })
      if (config.useMock) {
        setTimeout(() => {
          set({ users: MOCK_APP_USERS, loading: false })
        }, 500)
        return
      }
      try {
        const data = await config.api.get('admin/users').json<{ total: number; items: AppUser[] }>()
        set({ users: Array.isArray(data?.items) ? data.items : [], loading: false })
      } catch (error) {
        set({ loading: false, error: errorMessage(error, '成员列表加载失败') })
      }
    },

    fetchBlockedUsers: async (params = {}) => {
      set({ blockedLoading: true, error: null })
      if (config.useMock) {
        set({ blockedUsers: [], blockedTotal: 0, blockedLoading: false })
        return
      }
      try {
        const query = new URLSearchParams()
        if (params.limit) query.set('limit', String(params.limit))
        if (params.offset) query.set('offset', String(params.offset))
        const suffix = query.toString() ? `?${query.toString()}` : ''
        const data = await config.api.get(`admin/blocked-members${suffix}`).json<{ total: number; items: AppMemberBlock[] }>()
        set({
          blockedUsers: Array.isArray(data?.items) ? data.items : [],
          blockedTotal: typeof data?.total === 'number' ? data.total : 0,
          blockedLoading: false,
        })
      } catch (error) {
        set({ blockedLoading: false, error: errorMessage(error, '拉黑名单加载失败') })
      }
    },

    changeRole: async (userId, role) => {
      if (config.useMock) {
        set({ users: get().users.map(u => u.id === userId ? { ...u, role } : u) })
        return
      }
      try {
        const updated = await config.api.patch(`admin/users/${userId}/role`, { json: { role } }).json<AppUser>()
        set({ users: mergeUser(get().users, userId, { ...updated, role }), error: null })
      } catch (error) {
        set({ error: errorMessage(error, '角色更新失败') })
      }
    },

    toggleDisabled: async (userId, disabled) => {
      if (config.useMock) {
        set({ users: get().users.map(u => u.id === userId ? { ...u, is_disabled: disabled, app_membership_status: disabled ? 'disabled' : 'active' } : u) })
        return
      }
      try {
        const updated = await config.api.patch(`admin/users/${userId}/disabled`, { json: { is_disabled: disabled } }).json<AppUser>()
        set({ users: mergeUser(get().users, userId, { ...updated, is_disabled: disabled, app_membership_status: disabled ? 'disabled' : 'active' }), error: null })
      } catch (error) {
        set({ error: errorMessage(error, disabled ? '禁止使用失败' : '恢复使用失败') })
      }
    },

    removeUser: async (userId) => {
      if (config.useMock) {
        set({ users: get().users.filter(u => u.id !== userId) })
        return
      }
      try {
        await config.api.delete(`admin/users/${userId}`).json<AppUser>()
        set({ users: get().users.filter(u => u.id !== userId), error: null })
      } catch (error) {
        set({ error: errorMessage(error, '移除成员失败') })
      }
    },

    blockUser: async (userId, reason) => {
      if (config.useMock) {
        set({ users: get().users.filter(u => u.id !== userId) })
        return
      }
      try {
        await config.api.post(`admin/users/${userId}/block`, { json: { reason: reason || '' } }).json()
        set({ users: get().users.filter(u => u.id !== userId), error: null })
        await get().fetchBlockedUsers()
      } catch (error) {
        set({ error: errorMessage(error, '拉黑成员失败') })
      }
    },

    unblockUser: async (appUserId) => {
      if (config.useMock) return
      try {
        await config.api.delete(`admin/blocked-members/${encodeURIComponent(appUserId)}`).json<AppMemberBlock>()
        set({
          blockedUsers: get().blockedUsers.filter(item => item.app_user_id !== appUserId),
          blockedTotal: Math.max(0, get().blockedTotal - 1),
          error: null,
        })
      } catch (error) {
        set({ error: errorMessage(error, '解除拉黑失败') })
      }
    },
  }))
}

export type AppUsersStore = ReturnType<typeof createAppUsersStore>

function mergeUser(users: AppUser[], userId: string, next: Partial<AppUser>): AppUser[] {
  return users.map(user => user.id === userId ? { ...user, ...next } : user)
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
