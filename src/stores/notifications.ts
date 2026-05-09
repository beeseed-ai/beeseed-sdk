import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { AppNotification } from '../core/types.js'
import { MOCK_NOTIFICATIONS } from '../mocks/notifications.js'

export interface NotificationsState {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean

  refresh: () => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
  handleWsNotification: (n: AppNotification) => void
  reset: () => void
}

export interface NotificationsStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createNotificationsStore(config: NotificationsStoreConfig) {
  return createStore<NotificationsState>()((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,

    refresh: async () => {
      set({ loading: true })
      if (config.useMock) {
        set({ notifications: MOCK_NOTIFICATIONS, unreadCount: MOCK_NOTIFICATIONS.filter((n) => !n.is_read).length, loading: false })
        return
      }
      try {
        const data = await config.api.get('notifications').json<{ notifications: AppNotification[] }>()
        const list = data.notifications || []
        set({ notifications: list, unreadCount: list.filter((n) => !n.is_read).length, loading: false })
      } catch { set({ loading: false }) }
    },

    markRead: async (id) => {
      if (config.useMock) {
        const updated = get().notifications.map((n) => n.id === id ? { ...n, is_read: true } : n)
        set({ notifications: updated, unreadCount: updated.filter((n) => !n.is_read).length })
        return
      }
      try {
        await config.api.post(`notifications/${id}/read`)
        const updated = get().notifications.map((n) => n.id === id ? { ...n, is_read: true } : n)
        set({ notifications: updated, unreadCount: updated.filter((n) => !n.is_read).length })
      } catch { /* */ }
    },

    markAllRead: async () => {
      if (config.useMock) {
        set({ notifications: get().notifications.map((n) => ({ ...n, is_read: true })), unreadCount: 0 })
        return
      }
      try {
        await config.api.post('notifications/read-all')
        set({ notifications: get().notifications.map((n) => ({ ...n, is_read: true })), unreadCount: 0 })
      } catch { /* */ }
    },

    handleWsNotification: (n) => {
      set({ notifications: [n, ...get().notifications], unreadCount: get().unreadCount + (n.is_read ? 0 : 1) })
    },

    reset: () => set({ notifications: [], unreadCount: 0, loading: false }),
  }))
}

export type NotificationsStore = ReturnType<typeof createNotificationsStore>
