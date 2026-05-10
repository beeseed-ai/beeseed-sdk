import { useState, useEffect, useCallback } from 'react'
import { Bot, Save } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useAgents } from '../../hooks/use-agents.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'

interface IdentityData {
  name: string
  content: string
}

interface AgentConfig {
  provider: string
  model: string
  temperature: number
  thinking: boolean
}

export function AgentManageTab() {
  const { agents, loading } = useAgents()
  const { api } = useBeeSeedContext()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [models, setModels] = useState<{ id: string; label: string; provider: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (agents.length > 0 && !selectedId) setSelectedId(agents[0].id)
  }, [agents, selectedId])

  useEffect(() => {
    api.get('models').json<{ id: string; label: string; provider: string }[]>().then(setModels).catch(() => {})
  }, [api])

  const loadAgent = useCallback(async (agentId: string) => {
    try {
      const [id, cfg] = await Promise.all([
        api.get(`agents/${agentId}/identity`).json<IdentityData>(),
        api.get(`agents/${agentId}/config`).json<AgentConfig>(),
      ])
      setIdentity(id)
      setAgentConfig(cfg)
      setDirty(false)
    } catch {
      setIdentity({ name: agentId, content: '' })
      setAgentConfig(null)
    }
  }, [api])

  useEffect(() => {
    if (selectedId) void loadAgent(selectedId)
  }, [selectedId, loadAgent])

  const handleSave = async () => {
    if (!selectedId || !identity) return
    setSaving(true)
    try {
      await api.put(`agents/${selectedId}/identity`, { json: { content: identity.content } })
      if (agentConfig) {
        await api.put(`agents/${selectedId}/config`, { json: agentConfig })
      }
      setDirty(false)
      void loadAgent(selectedId)
    } catch (e) {
      console.error('save failed', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[#999]">加载中...</div>
  }

  return (
    <div className="flex h-full">
      {/* Left: Agent list */}
      <div className="w-52 border-r border-border flex flex-col bg-[#fafaf8]">
        <div className="px-3 py-2.5 text-xs font-medium text-[#999] uppercase tracking-wide">Agents</div>
        <div className="flex-1 overflow-y-auto">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedId(agent.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                selectedId === agent.id ? 'bg-white border-r-2 border-[#1a1a1a]' : 'hover:bg-white/60',
              )}
            >
              <div className="w-7 h-7 rounded-full bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-[#F59E0B]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{agent.display_name || agent.id}</div>
                <div className="text-[10px] text-[#999] truncate">{agent.model}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Editor */}
      {selectedId && identity ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold">{identity.name}</h3>
              <span className="text-[11px] text-[#999]">ID: {selectedId}</span>
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
            {/* Identity content */}
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">Identity（系统提示词）</label>
              <p className="text-[11px] text-[#999] mb-2">第一行 # 标题 即为 Agent 显示名</p>
              <textarea
                value={identity.content}
                onChange={(e) => { setIdentity({ ...identity, content: e.target.value }); setDirty(true) }}
                className="w-full h-48 px-3 py-2 text-sm font-mono border border-border rounded-lg resize-y bg-white focus:outline-none focus:border-[#999] transition-colors"
                placeholder="# Agent 名字&#10;&#10;你的身份描述..."
              />
            </div>

            {/* Model config */}
            {agentConfig && (
              <>
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
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={agentConfig.temperature}
                    onChange={(e) => { setAgentConfig({ ...agentConfig, temperature: parseFloat(e.target.value) }); setDirty(true) }}
                    className="w-full"
                  />
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
