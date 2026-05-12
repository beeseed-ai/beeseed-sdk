import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useInvites() {
  const { invitesStore } = useBeeSeedContext()
  const state = useStore(invitesStore)

  useEffect(() => { void state.fetchInvites() }, [])

  return {
    invites: state.invites,
    loading: state.loading,
    createInvite: state.createInvite,
    revokeInvite: state.revokeInvite
  }
}
