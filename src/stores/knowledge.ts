import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { KnowledgeSource, KnowledgeSearchResult, KnowledgeEntity, KnowledgeGraphData } from '../core/types.js'
import { MOCK_SOURCES, MOCK_SEARCH_RESULTS, MOCK_ENTITIES, MOCK_GRAPH } from '../mocks/knowledge.js'

export interface KnowledgeState {
  sources: KnowledgeSource[]
  loading: boolean
  uploading: boolean
  searchQuery: string
  searchResults: KnowledgeSearchResult[]
  entityResults: KnowledgeEntity[]
  searching: boolean
  graphData: KnowledgeGraphData | null
  graphLoading: boolean
  selectedSource: KnowledgeSource | null

  loadSources: () => Promise<void>
  deleteSource: (sourceId: number) => Promise<void>
  search: (query: string) => Promise<void>
  loadGraph: () => Promise<void>
  setSearchQuery: (q: string) => void
  setSelectedSource: (s: KnowledgeSource | null) => void
  reset: () => void
}

export interface KnowledgeStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createKnowledgeStore(config: KnowledgeStoreConfig) {
  return createStore<KnowledgeState>()((set, get) => ({
    sources: [],
    loading: false,
    uploading: false,
    searchQuery: '',
    searchResults: [],
    entityResults: [],
    searching: false,
    graphData: null,
    graphLoading: false,
    selectedSource: null,

    loadSources: async () => {
      set({ loading: true })
      if (config.useMock) { set({ sources: MOCK_SOURCES, loading: false }); return }
      try {
        const data = await config.api.get('knowledge').json<{ sources: KnowledgeSource[] }>()
        set({ sources: data.sources, loading: false })
      } catch { set({ loading: false }) }
    },

    deleteSource: async (sourceId) => {
      if (config.useMock) { set({ sources: get().sources.filter((s) => s.id !== sourceId) }); return }
      try {
        await config.api.delete(`knowledge/${sourceId}`)
        set({ sources: get().sources.filter((s) => s.id !== sourceId) })
      } catch { /* */ }
    },

    search: async (query) => {
      set({ searching: true, searchQuery: query })
      if (config.useMock) {
        set({ searchResults: MOCK_SEARCH_RESULTS, entityResults: MOCK_ENTITIES, searching: false })
        return
      }
      try {
        const data = await config.api.post('knowledge/search', { json: { query } }).json<{ results: KnowledgeSearchResult[]; entities: KnowledgeEntity[] }>()
        set({ searchResults: data.results, entityResults: data.entities ?? [], searching: false })
      } catch { set({ searching: false }) }
    },

    loadGraph: async () => {
      set({ graphLoading: true })
      if (config.useMock) { set({ graphData: MOCK_GRAPH, graphLoading: false }); return }
      try {
        const data = await config.api.get('knowledge/graph').json<KnowledgeGraphData>()
        set({ graphData: data, graphLoading: false })
      } catch { set({ graphLoading: false }) }
    },

    setSearchQuery: (q) => set({ searchQuery: q }),
    setSelectedSource: (s) => set({ selectedSource: s }),
    reset: () => set({ sources: [], loading: false, searchQuery: '', searchResults: [], entityResults: [], graphData: null, selectedSource: null }),
  }))
}

export type KnowledgeStore = ReturnType<typeof createKnowledgeStore>
