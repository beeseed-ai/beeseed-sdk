import { useState, useEffect, useCallback, useMemo } from 'react'
import { Bot, Save, Hash } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'

interface AgentInfo { id: string; room_id: string; room_name?: string; name: string; model: string; provider: string; avatar_url?: string }
interface IdentityData { name: string; personality: string; content: string }
interface AgentConfig {
  provider: string
  model: string
  temperature: number
  thinking: boolean
  tools: string[]
  avatar_preset: string
}

interface Selection { roomId: string; agentId: string; key: string }

const ALL_TOOLS = ['shell', 'file_read', 'file_write', 'file_edit', 'glob_search', 'content_search', 'http_request', 'state']

export function AgentManageTab() {
  const { api } = useBeeSeedContext()
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [models, setModels] = useState<{ id: string; label: string; provider: string }[]>([])
  const [providers, setProviders] = useState<{ id: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [presets, setPresets] = useState<string[]>([])

  useEffect(() => {
    api.get('agents').json<AgentInfo[]>().then((data) => { setAgents(data ?? []); setLoading(false) }).catch(() => setLoading(false))
    api.get('models').json<{ id: string; label: string; provider: string }[]>().then((d) => setModels(d ?? [])).catch(() => {})
    api.get('providers').json<{ id: string; label: string }[]>().then((d) => setProviders(d ?? [])).catch(() => {})
    api.get('agents/presets').json<string[]>().then((d) => setPresets(d ?? [])).catch(() => {})
  }, [api])

  useEffect(() => {
    if (agents.length > 0 && !selected) {
      const a = agents[0]
      setSelected({ roomId: a.room_id, agentId: a.id, key: `${a.room_id}:${a.id}` })
    }
  }, [agents, selected])

  const roomGroups = useMemo(() => {
    const map = new Map<string, { roomId: string; roomName: string; agents: AgentInfo[] }>()
    for (const agent of agents) {
      const rId = agent.room_id || ''
      let group = map.get(rId)
      if (!group) {
        group = { roomId: rId, roomName: agent.room_name || '未分配', agents: [] }
        map.set(rId, group)
      }
      group.agents.push(agent)
    }
    return [...map.values()]
  }, [agents])

  const loadAgent = useCallback(async (roomId: string, agentId: string) => {
    try {
      const basePath = roomId ? `rooms/${roomId}/agents/${agentId}` : `agents/${agentId}`
      const [id, cfg] = await Promise.all([
        api.get(`${basePath}/identity`).json<IdentityData>(),
        api.get(`${basePath}/config`).json<AgentConfig>(),
      ])
      setIdentity(id)
      setAgentConfig(cfg)
      setDirty(false)
    } catch {
      setIdentity({ name: agentId, personality: '', content: '' })
      setAgentConfig(null)
    }
  }, [api])

  useEffect(() => {
    if (selected) void loadAgent(selected.roomId, selected.agentId)
  }, [selected, loadAgent])

  const handleSave = async () => {
    if (!selected || !identity) return
    setSaving(true)
    try {
      const basePath = selected.roomId ? `rooms/${selected.roomId}/agents/${selected.agentId}` : `agents/${selected.agentId}`
      await api.put(`${basePath}/identity`, { json: identity })
      if (agentConfig) {
        await api.put(`${basePath}/config`, { json: agentConfig })
      }
      setDirty(false)
      const updated = await api.get('agents').json<AgentInfo[]>()
      setAgents(updated)
      void loadAgent(selected.roomId, selected.agentId)
    } catch (e) {
      console.error('save failed', e)
    } finally {
      setSaving(false)
    }
  }

  const toggleTool = (tool: string) => {
    if (!agentConfig) return
    const tools = agentConfig.tools || []
    const next = tools.includes(tool) ? tools.filter((t) => t !== tool) : [...tools, tool]
    setAgentConfig({ ...agentConfig, tools: next })
    setDirty(true)
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[#999]">加载中...</div>
  }

  return (
    <div className="flex h-full">
      {/* Left: Agent list grouped by Room */}
      <div className="w-56 border-r border-border flex flex-col bg-[#fafaf8] overflow-y-auto">
        {roomGroups.map((group) => (
          <div key={group.roomId || '_none'}>
            <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
              <Hash className="w-3 h-3 text-[#bbb]" />
              <span className="text-[11px] font-medium text-[#999] truncate">{group.roomName}</span>
            </div>
            {group.agents.map((agent) => {
              const itemKey = `${agent.room_id}:${agent.id}`
              return (
                <button
                  key={itemKey}
                  onClick={() => setSelected({ roomId: agent.room_id, agentId: agent.id, key: itemKey })}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                    selected?.key === itemKey ? 'bg-white border-r-2 border-[#1a1a1a]' : 'hover:bg-white/60',
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-[#F59E0B]/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {agent.avatar_url ? (
                      <img src={agent.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-[#F59E0B]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{agent.name || agent.id}</div>
                    <div className="text-[10px] text-[#999] truncate">{agent.model}</div>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Right: Editor */}
      {selected && identity ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold">{identity.name}</h3>
              <span className="text-[11px] text-[#999]">ID: {selected.agentId}</span>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                dirty
                  ? 'bg-[#1a1a1a] text-white hover:bg-[#333]'
                  : 'bg-[#f5f5f5] text-[#999] cursor-not-allowed',
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? '保存中...' : '保存'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Avatar preset picker */}
            {agentConfig && presets.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#555] mb-1.5">头像</label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => {
                    const url = `/avatars/agents/${preset}.svg`
                    const isSelected = agentConfig.avatar_preset === preset
                    return (
                      <button
                        key={preset}
                        onClick={() => { setAgentConfig({ ...agentConfig, avatar_preset: preset }); setDirty(true) }}
                        className={cn(
                          'w-10 h-10 rounded-full overflow-hidden border-2 transition-all',
                          isSelected ? 'border-[#1a1a1a] scale-110' : 'border-transparent hover:border-[#ccc]',
                        )}
                      >
                        <img src={url} alt={preset} className="w-full h-full" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">名字</label>
              <input
                type="text"
                value={identity.name === selected.agentId ? '' : identity.name}
                onChange={(e) => { setIdentity({ ...identity, name: e.target.value }); setDirty(true) }}
                placeholder="给 Agent 起个名字"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-[#999] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">性格特点</label>
              <input
                type="text"
                value={identity.personality}
                onChange={(e) => { setIdentity({ ...identity, personality: e.target.value }); setDirty(true) }}
                placeholder="例：活泼开朗、善于倾听、逻辑严谨"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-[#999] transition-colors"
              />
            </div>

            <details className="text-xs">
              <summary className="text-[#999] cursor-pointer select-none mb-1.5">Identity 原始内容（高级）</summary>
              <textarea
                value={identity.content}
                onChange={(e) => { setIdentity({ ...identity, content: e.target.value }); setDirty(true) }}
                className="w-full h-36 px-3 py-2 text-sm font-mono border border-border rounded-lg resize-y bg-[#fafafa] focus:outline-none focus:border-[#999] transition-colors"
              />
            </details>

            {agentConfig && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#555] mb-1.5">Provider</label>
                  <select
                    value={agentConfig.provider}
                    onChange={(e) => { setAgentConfig({ ...agentConfig, provider: e.target.value }); setDirty(true) }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-[#999]"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.label || p.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#555] mb-1.5">模型</label>
                  <select
                    value={agentConfig.model}
                    onChange={(e) => { setAgentConfig({ ...agentConfig, model: e.target.value }); setDirty(true) }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-[#999]"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label || m.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#555] mb-1.5">
                    Temperature: {agentConfig.temperature.toFixed(1)}
                  </label>
                  <input
                    type="range" min="0" max="2" step="0.1"
                    value={agentConfig.temperature}
                    onChange={(e) => { setAgentConfig({ ...agentConfig, temperature: parseFloat(e.target.value) }); setDirty(true) }}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="thinking-toggle"
                    checked={agentConfig.thinking}
                    onChange={(e) => { setAgentConfig({ ...agentConfig, thinking: e.target.checked }); setDirty(true) }}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="thinking-toggle" className="text-xs font-medium text-[#555]">
                    启用 Thinking（深度思考模式）
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#555] mb-1.5">工具</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_TOOLS.map((tool) => {
                      const enabled = (agentConfig.tools || []).includes(tool)
                      return (
                        <button
                          key={tool}
                          onClick={() => toggleTool(tool)}
                          className={cn(
                            'px-2.5 py-1 text-xs rounded-md border transition-colors',
                            enabled
                              ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
                              : 'border-border text-[#999] hover:border-[#999]',
                          )}
                        >
                          {tool}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-[#999]">
          选择一个 Agent 查看详情
        </div>
      )}
    </div>
  )
}
