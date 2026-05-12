import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useAppUsers() {
  const { appUsersStore } = useBeeSeedContext()
  const state = useStore(appUsersStore)

  useEffect(() => { void state.fetchUsers() }, [])

  return {
    users: state.users,
    loading: state.loading,
    changeRole: state.changeRole,
    toggleDisabled: state.toggleDisabled
  }
}
