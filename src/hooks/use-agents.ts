import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useAgents() {
  const { agentsStore } = useBeeSeedContext()
  const state = useStore(agentsStore)

  useEffect(() => { void state.fetchAgents() }, [])

  return {
    agents: state.agents,
    loading: state.loading,
    selectedAgent: state.selectedAgent,
    createAgent: state.createAgent,
    deleteAgent: state.deleteAgent,
    getConfig: state.getConfig,
    updateConfig: state.updateConfig,
    setSelected: state.setSelected,
  }
}
