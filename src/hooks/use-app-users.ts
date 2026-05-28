import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useAppUsers() {
  const { appUsersStore } = useBeeSeedContext()
  const state = useStore(appUsersStore)

  useEffect(() => { void state.fetchUsers() }, [])

  return {
    users: state.users,
    blockedUsers: state.blockedUsers,
    blockedTotal: state.blockedTotal,
    loading: state.loading,
    blockedLoading: state.blockedLoading,
    error: state.error,
    fetchBlockedUsers: state.fetchBlockedUsers,
    changeRole: state.changeRole,
    toggleDisabled: state.toggleDisabled,
    removeUser: state.removeUser,
    blockUser: state.blockUser,
    unblockUser: state.unblockUser
  }
}
