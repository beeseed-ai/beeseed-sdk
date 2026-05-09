import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { AgentMeta, AgentConfig } from '../core/types.js'
import { MOCK_AGENTS } from '../mocks/agents.js'

export interface AgentsState {
  agents: AgentMeta[]
  loading: boolean
  selectedAgent: AgentMeta | null

  fetchAgents: () => Promise<void>
  createAgent: (data: { id: string }) => Promise<AgentMeta | null>
  deleteAgent: (agentId: string) => Promise<void>
  getConfig: (agentId: string) => Promise<AgentConfig | null>
  updateConfig: (agentId: string, config: Partial<AgentConfig>) => Promise<void>
  setSelected: (agent: AgentMeta | null) => void
  reset: () => void
}

export interface AgentsStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createAgentsStore(config: AgentsStoreConfig) {
  return createStore<AgentsState>()((set, get) => ({
    agents: [],
    loading: false,
    selectedAgent: null,

    fetchAgents: async () => {
      set({ loading: true })
      if (config.useMock) { set({ agents: MOCK_AGENTS, loading: false }); return }
      try {
        const data = await config.api.get('agents').json<AgentMeta[]>()
        set({ agents: data, loading: false })
      } catch { set({ loading: false }) }
    },

    createAgent: async (data) => {
      if (config.useMock) {
        const agent: AgentMeta = { id: data.id, model: 'default', provider: 'beeseed', created_at: new Date().toISOString() }
        set({ agents: [...get().agents, agent] })
        return agent
      }
      try {
        const agent = await config.api.post('agents', { json: data }).json<AgentMeta>()
        set({ agents: [...get().agents, agent] })
        return agent
      } catch { return null }
    },

    deleteAgent: async (agentId) => {
      if (config.useMock) { set({ agents: get().agents.filter((a) => a.id !== agentId) }); return }
      try {
        await config.api.delete(`agents/${agentId}`)
        set({ agents: get().agents.filter((a) => a.id !== agentId) })
      } catch { /* */ }
    },

    getConfig: async (agentId) => {
      if (config.useMock) return { model: 'deepseek-v4', provider: 'beeseed', tools: ['search', 'read'], temperature: 0.7 }
      try {
        return await config.api.get(`agents/${agentId}/config`).json<AgentConfig>()
      } catch { return null }
    },

    updateConfig: async (agentId, cfg) => {
      if (config.useMock) return
      try {
        await config.api.put(`agents/${agentId}/config`, { json: cfg })
      } catch { /* */ }
    },

    setSelected: (agent) => set({ selectedAgent: agent }),
    reset: () => set({ agents: [], loading: false, selectedAgent: null }),
  }))
}

export type AgentsStore = ReturnType<typeof createAgentsStore>
