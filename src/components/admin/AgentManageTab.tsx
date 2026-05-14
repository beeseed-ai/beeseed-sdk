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
    <div className="flex h-full">
      {/* Left: Agent list grouped by Channel */}
      <div className="w-56 border-r border-border flex flex-col bg-[#fafaf8] overflow-y-auto">
        <div className="border-b border-border px-3 py-2">
          <div className="text-xs font-medium text-[#555]">Agent 模板</div>
          <div className="mt-0.5 text-[10px] text-[#999]">{templates.length} 个模板</div>
        </div>
        {templates.length === 0 ? (
          <div className="px-3 py-4 text-xs leading-5 text-[#999]">
            暂无 Agent 模板。模板用于决定频道 Agent 的默认能力边界。
          </div>
        ) : templates.map((template) => (
          <button
            key={template.id}
            onClick={() => setSelectedId(template.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
              selectedId === template.id ? 'bg-white border-r-2 border-[#1a1a1a]' : 'hover:bg-white/60',
            )}
          >
            <div className="w-7 h-7 rounded-full bg-[#F59E0B]/10 flex items-center justify-center shrink-0 overflow-hidden">
              {template.avatar_url ? (
                <img src={template.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <Bot className="w-3.5 h-3.5 text-[#F59E0B]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{template.name || template.id}</div>
              <div className="text-[10px] text-[#999] truncate">{template.model}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Right: Editor */}
      {selectedId && identity ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold">{identity.name}</h3>
              <span className="text-[11px] text-[#999]">模板 ID: {selectedId}</span>
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
                value={identity.name === selectedId ? '' : identity.name}
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
          选择一个 Agent 模板进行编辑
        </div>
      )}
    </div>
  )
}
