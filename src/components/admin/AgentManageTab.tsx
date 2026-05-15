import { useState, useEffect, useCallback } from 'react'
import { Bot, Save } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import type { ChannelMemberInfo, ChannelWithMeta } from '../../core/types.js'

interface AgentInstanceInfo {
  id: string
  channelId: string
  channelName: string
  name: string
  model: string
  provider: string
  avatar_url?: string
}
interface IdentityData { name: string; personality: string; content: string }
interface AgentConfig {
  role?: string
  provider: string
  model: string
  temperature: number
  thinking: boolean
  tools: string[]
  avatar_preset: string
  [key: string]: unknown
}

const FALLBACK_TOOLS = [
  'http_request',
  'ask_user',
  'knowledge_search',
  'storage_list',
  'storage_info',
  'storage_read',
  'storage_write',
  'storage_delete',
  'storage_presign_download',
]

function agentKey(channelId: string, agentId: string) {
  return `${channelId}:${agentId}`
}

function splitAgentKey(key: string | null) {
  if (!key) return null
  const [channelId, ...agentParts] = key.split(':')
  const agentId = agentParts.join(':')
  if (!channelId || !agentId) return null
  return { channelId, agentId }
}

function uniqueTools(...groups: Array<string[] | undefined>) {
  return Array.from(new Set(groups.flatMap((group) => group ?? []).filter(Boolean)))
}

export function AgentManageTab() {
  const { api } = useBeeSeedContext()
  const [agents, setAgents] = useState<AgentInstanceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [models, setModels] = useState<{ id: string; label: string; provider: string }[]>([])
  const [providers, setProviders] = useState<{ id: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [presets, setPresets] = useState<string[]>([])
  const [tools, setTools] = useState<string[]>(FALLBACK_TOOLS)

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const channels = await api.get('channels').json<ChannelWithMeta[]>()
      const instances = await Promise.all((channels ?? []).map(async (channel) => {
        const members = await api.get(`channels/${channel.id}/members`).json<ChannelMemberInfo[]>().catch(() => [])
        return members
          .filter((member) => member.member_type === 'agent' && member.agent_id)
          .map((member) => ({
            id: member.agent_id as string,
            channelId: channel.id,
            channelName: channel.name || '未命名频道',
            name: member.display_name || member.nickname || member.agent_id || 'Agent',
            model: '',
            provider: '',
            avatar_url: member.avatar_url,
          }))
      }))
      const flat = instances.flat()
      const enriched = await Promise.all(flat.map(async (agent) => {
        const basePath = `channels/${agent.channelId}/agents/${agent.id}`
        const [id, cfg] = await Promise.all([
          api.get(`${basePath}/identity`).json<IdentityData>().catch(() => null),
          api.get(`${basePath}/config`).json<AgentConfig>().catch(() => null),
        ])
        return {
          ...agent,
          name: id?.name || agent.name,
          model: cfg?.model || agent.model,
          provider: cfg?.provider || agent.provider,
        }
      }))
      setAgents(enriched)
      setLoading(false)
    } catch {
      setAgents([])
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void loadAgents()
    api.get('models').json<{ id: string; label: string; provider: string }[]>().then((d) => setModels(d ?? [])).catch(() => {})
    api.get('providers').json<{ id: string; label: string }[]>().then((d) => setProviders(d ?? [])).catch(() => {})
    api.get('agents/presets').json<string[]>().then((d) => setPresets(d ?? [])).catch(() => {})
    api.get('tools').json<string[]>().then((d) => setTools(d?.length ? d : FALLBACK_TOOLS)).catch(() => {})
  }, [api, loadAgents])

  useEffect(() => {
    if (agents.length > 0 && (!selectedKey || !agents.some((agent) => agentKey(agent.channelId, agent.id) === selectedKey))) {
      setSelectedKey(agentKey(agents[0].channelId, agents[0].id))
      return
    }
    if (agents.length === 0 && selectedKey) {
      setSelectedKey(null)
    }
  }, [selectedKey, agents])

  const loadAgent = useCallback(async (key: string) => {
    const selected = splitAgentKey(key)
    if (!selected) return
    try {
      const basePath = `channels/${selected.channelId}/agents/${selected.agentId}`
      const [id, cfg] = await Promise.all([
        api.get(`${basePath}/identity`).json<IdentityData>(),
        api.get(`${basePath}/config`).json<AgentConfig>(),
      ])
      setIdentity(id)
      setAgentConfig({ ...cfg, tools: cfg.tools || [] })
      setDirty(false)
    } catch {
      setIdentity({ name: selected.agentId, personality: '', content: '' })
      setAgentConfig(null)
    }
  }, [api])

  useEffect(() => {
    if (selectedKey) void loadAgent(selectedKey)
  }, [selectedKey, loadAgent])

  const handleSave = async () => {
    const selected = splitAgentKey(selectedKey)
    if (!selected || !identity) return
    setSaving(true)
    try {
      const basePath = `channels/${selected.channelId}/agents/${selected.agentId}`
      await api.put(`${basePath}/identity`, { json: identity })
      if (agentConfig) {
        await api.put(`${basePath}/config`, { json: agentConfig })
      }
      setDirty(false)
      await loadAgents()
      void loadAgent(selectedKey as string)
    } catch (e) {
      console.error('save failed', e)
    } finally {
      setSaving(false)
    }
  }

  const toggleTool = (tool: string) => {
    if (!agentConfig) return
    const current = agentConfig.tools || []
    const next = current.includes(tool) ? current.filter((t) => t !== tool) : [...current, tool]
    setAgentConfig({ ...agentConfig, tools: next })
    setDirty(true)
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[#999]">加载中...</div>
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#1a1a1a]">Agent 管理</h1>
              <p className="mt-1 text-sm text-muted-foreground">{agents.length} 个频道 Agent</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-sm font-semibold text-[#1a1a1a]">Agent 列表</h3>
              </div>
              <div className="max-h-[640px] space-y-2 overflow-y-auto p-3">
                {agents.length === 0 ? (
                  <div className="rounded-lg border border-border p-3 text-xs leading-5 text-muted-foreground">
                    当前 App 暂无频道 Agent。创建频道或在频道中添加 Agent 后，可在这里配置其模型与身份。
                  </div>
                ) : agents.map((agent) => {
                  const key = agentKey(agent.channelId, agent.id)
                  return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      selectedKey === key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#181d26]/10">
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <Bot className="h-4 w-4 text-[#181d26]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#1a1a1a]">{agent.name || agent.id}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{agent.channelName}</div>
                      {agent.model && <div className="mt-0.5 truncate text-xs text-muted-foreground">{agent.model}</div>}
                    </div>
                  </button>
                )})}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              {selectedKey && identity ? (
                <>
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#1a1a1a]">{identity.name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {agents.find((agent) => agentKey(agent.channelId, agent.id) === selectedKey)?.channelName} · Agent ID: {splitAgentKey(selectedKey)?.agentId}
                      </span>
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={saving || !dirty}
                      className={cn(
                        'flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors',
                        dirty
                          ? 'bg-[#181d26] text-white hover:bg-[#0d1218]'
                          : 'cursor-not-allowed bg-[#f5f5f5] text-[#999]',
                      )}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving ? '保存中...' : '保存'}
                    </button>
                  </div>

                  <div className="space-y-5 p-5">
                    {agentConfig && presets.length > 0 && (
                      <div>
                        <label className="mb-2 block text-xs font-medium text-[#555]">头像</label>
                        <div className="flex flex-wrap gap-2">
                          {presets.map((preset) => {
                            const url = `/avatars/agents/${preset}.svg`
                            const isSelected = agentConfig.avatar_preset === preset
                            return (
                              <button
                                key={preset}
                                onClick={() => { setAgentConfig({ ...agentConfig, avatar_preset: preset }); setDirty(true) }}
                                className={cn(
                                  'h-10 w-10 overflow-hidden rounded-full border-2 transition-all',
                                  isSelected ? 'border-[#181d26]' : 'border-transparent hover:border-[#9297a0]',
                                )}
                              >
                                <img src={url} alt={preset} className="h-full w-full" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">名字</label>
                        <input
                          type="text"
                          value={identity.name === splitAgentKey(selectedKey)?.agentId ? '' : identity.name}
                          onChange={(e) => { setIdentity({ ...identity, name: e.target.value }); setDirty(true) }}
                          placeholder="给 Agent 起个名字"
                          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm transition-colors focus:outline-none focus:border-[#9297a0]"
                        />
                      </div>

                      {agentConfig && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[#555]">模型</label>
                          <select
                            value={agentConfig.model}
                            onChange={(e) => { setAgentConfig({ ...agentConfig, model: e.target.value }); setDirty(true) }}
                            className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm focus:outline-none focus:border-[#9297a0]"
                          >
                            {models.map((m) => (
                              <option key={m.id} value={m.id}>{m.label || m.id}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">性格特点</label>
                      <input
                        type="text"
                        value={identity.personality}
                        onChange={(e) => { setIdentity({ ...identity, personality: e.target.value }); setDirty(true) }}
                        placeholder="例：活泼开朗、善于倾听、逻辑严谨"
                        className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm transition-colors focus:outline-none focus:border-[#9297a0]"
                      />
                    </div>

                    {agentConfig && (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#555]">Provider</label>
                            <select
                              value={agentConfig.provider}
                              onChange={(e) => { setAgentConfig({ ...agentConfig, provider: e.target.value }); setDirty(true) }}
                              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm focus:outline-none focus:border-[#9297a0]"
                            >
                              {providers.map((p) => (
                                <option key={p.id} value={p.id}>{p.label || p.id}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-[#555]">
                              Temperature: {agentConfig.temperature.toFixed(1)}
                            </label>
                            <input
                              type="range" min="0" max="2" step="0.1"
                              value={agentConfig.temperature}
                              onChange={(e) => { setAgentConfig({ ...agentConfig, temperature: parseFloat(e.target.value) }); setDirty(true) }}
                              className="h-9 w-full"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-[#555]">
                          <input
                            type="checkbox"
                            id="thinking-toggle"
                            checked={agentConfig.thinking}
                            onChange={(e) => { setAgentConfig({ ...agentConfig, thinking: e.target.checked }); setDirty(true) }}
                            className="h-4 w-4 rounded border-border"
                          />
                          启用 Thinking（深度思考模式）
                        </label>

                          <div>
                            <label className="mb-2 block text-xs font-medium text-[#555]">工具</label>
                            <div className="flex flex-wrap gap-2">
                            {uniqueTools(tools, agentConfig.tools).map((tool) => {
                              const enabled = (agentConfig.tools || []).includes(tool)
                              return (
                                <button
                                  key={tool}
                                  onClick={() => toggleTool(tool)}
                                  className={cn(
                                    'rounded-md border px-2.5 py-1 text-xs transition-colors',
                                    enabled
                                      ? 'border-[#181d26] bg-[#181d26] text-white'
                                      : 'border-border text-muted-foreground hover:border-[#9297a0] hover:text-[#181d26]',
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

                    <details className="text-xs">
                      <summary className="mb-1.5 cursor-pointer select-none text-muted-foreground">Identity 原始内容（高级）</summary>
                      <textarea
                        value={identity.content}
                        onChange={(e) => { setIdentity({ ...identity, content: e.target.value }); setDirty(true) }}
                        className="h-36 w-full resize-y rounded-lg border border-border bg-[#fafafa] px-3 py-2 font-mono text-sm transition-colors focus:outline-none focus:border-[#9297a0]"
                      />
                    </details>
                  </div>
                </>
              ) : (
                <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
                  选择一个频道 Agent 进行编辑
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
