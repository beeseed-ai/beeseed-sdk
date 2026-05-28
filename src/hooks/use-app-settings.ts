import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useAppSettings() {
  const { appSettingsStore } = useBeeSeedContext()
  const state = useStore(appSettingsStore)

  useEffect(() => { void state.fetchSettings() }, [])

  return {
    registrationPolicy: state.registrationPolicy,
    accessPolicy: state.accessPolicy,
    joinMode: state.joinMode,
    allowNewHiveUsers: state.allowNewHiveUsers,
    loading: state.loading,
    setRegistrationPolicy: state.setRegistrationPolicy,
    setJoinMode: state.setJoinMode,
  }
}
