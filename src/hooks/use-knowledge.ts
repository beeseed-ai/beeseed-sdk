import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useKnowledge() {
  const { knowledgeStore } = useBeeSeedContext()
  const state = useStore(knowledgeStore)

  useEffect(() => { void state.loadSources() }, [])

  return {
    sources: state.sources,
    loading: state.loading,
    searchQuery: state.searchQuery,
    searchResults: state.searchResults,
    entityResults: state.entityResults,
    searching: state.searching,
    graphData: state.graphData,
    graphLoading: state.graphLoading,
    selectedSource: state.selectedSource,
    deleteSource: state.deleteSource,
    search: state.search,
    loadGraph: state.loadGraph,
    setSearchQuery: state.setSearchQuery,
    setSelectedSource: state.setSelectedSource,
  }
}
