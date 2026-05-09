import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useNotifications() {
  const { notificationsStore } = useBeeSeedContext()
  const state = useStore(notificationsStore)

  useEffect(() => { void state.refresh() }, [])

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    markRead: state.markRead,
    markAllRead: state.markAllRead,
    refresh: state.refresh,
  }
}
