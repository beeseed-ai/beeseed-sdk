import { useState, useEffect, useCallback } from 'react'
import { Bot, Save } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'

interface AgentTemplateInfo { id: string; name: string; role: string; model: string; provider: string; avatar_url?: string }
interface IdentityData { name: string; personality: string; content: string }
interface AgentConfig {
  provider: string
  model: string
  temperature: number
  thinking: boolean
  tools: string[]
  avatar_preset: string
}

const ALL_TOOLS = [
  'http_request',
  'storage_list',
  'storage_read',
  'storage_write',
  'storage_delete',
  'storage_presign_download',
]
const ALL_TOOL_NAMES = new Set(ALL_TOOLS)
const sanitizeTools = (tools: string[] = []) => tools.filter((tool) => ALL_TOOL_NAMES.has(tool))

export function AgentManageTab() {
  const { api } = useBeeSeedContext()
  const [templates, setTemplates] = useState<AgentTemplateInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [models, setModels] = useState<{ id: string; label: string; provider: string }[]>([])
  const [providers, setProviders] = useState<{ id: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [presets, setPresets] = useState<string[]>([])

  useEffect(() => {
    api.get('admin/agent-templates').json<AgentTemplateInfo[]>().then((data) => { setTemplates(data ?? []); setLoading(false) }).catch(() => setLoading(false))
    api.get('models').json<{ id: string; label: string; provider: string }[]>().then((d) => setModels(d ?? [])).catch(() => {})
    api.get('providers').json<{ id: string; label: string }[]>().then((d) => setProviders(d ?? [])).catch(() => {})
    api.get('agents/presets').json<string[]>().then((d) => setPresets(d ?? [])).catch(() => {})
  }, [api])

  useEffect(() => {
    if (templates.length > 0 && (!selectedId || !templates.some((template) => template.id === selectedId))) {
      setSelectedId(templates[0].id)
      return
    }
    if (templates.length === 0 && selectedId) {
      setSelectedId(null)
    }
  }, [selectedId, templates])

  const loadTemplate = useCallback(async (agentId: string) => {
    try {
      const basePath = `admin/agent-templates/${agentId}`
      const [id, cfg] = await Promise.all([
        api.get(`${basePath}/identity`).json<IdentityData>(),
        api.get(`${basePath}/config`).json<AgentConfig>(),
      ])
      setIdentity(id)
      setAgentConfig({ ...cfg, tools: sanitizeTools(cfg.tools || []) })
      setDirty(false)
    } catch {
      setIdentity({ name: agentId, personality: '', content: '' })
      setAgentConfig(null)
    }
  }, [api])

  useEffect(() => {
    if (selectedId) void loadTemplate(selectedId)
  }, [selectedId, loadTemplate])

  const handleSave = async () => {
    if (!selectedId || !identity) return
    setSaving(true)
    try {
      const basePath = `admin/agent-templates/${selectedId}`
      await api.put(`${basePath}/identity`, { json: identity })
      if (agentConfig) {
        await api.put(`${basePath}/config`, { json: agentConfig })
      }
      setDirty(false)
      const updated = await api.get('admin/agent-templates').json<AgentTemplateInfo[]>()
      setTemplates(updated)
      void loadTemplate(selectedId)
    } catch (e) {
      console.error('save failed', e)
    } finally {
      setSaving(false)
    }
  }

  const toggleTool = (tool: string) => {
    if (!agentConfig) return
    const tools = sanitizeTools(agentConfig.tools || [])
    const next = tools.includes(tool) ? tools.filter((t) => t !== tool) : [...tools, tool]
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
              <h1 className="text-xl font-bold text-[#1a1a1a]">Agent 模板</h1>
              <p className="mt-1 text-sm text-muted-foreground">{templates.length} 个模板</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-sm font-semibold text-[#1a1a1a]">模板列表</h3>
              </div>
              <div className="max-h-[640px] space-y-2 overflow-y-auto p-3">
                {templates.length === 0 ? (
                  <div className="rounded-lg border border-border p-3 text-xs leading-5 text-muted-foreground">
                    暂无 Agent 模板。模板用于决定频道 Agent 的默认能力边界。
                  </div>
                ) : templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedId(template.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      selectedId === template.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#181d26]/10">
                      {template.avatar_url ? (
                        <img src={template.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <Bot className="h-4 w-4 text-[#181d26]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#1a1a1a]">{template.name || template.id}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{template.model}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              {selectedId && identity ? (
                <>
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#1a1a1a]">{identity.name}</h3>
                      <span className="text-xs text-muted-foreground">模板 ID: {selectedId}</span>
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
                          value={identity.name === selectedId ? '' : identity.name}
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
                            {ALL_TOOLS.map((tool) => {
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
                  选择一个 Agent 模板进行编辑
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
