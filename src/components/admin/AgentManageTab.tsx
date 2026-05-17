import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Save } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'

interface AgentTemplateInfo {
  id: string
  name: string
  role: string
  provider: string
  model: string
  avatar_preset?: string
  avatar_url?: string
  tools?: string[]
  skills?: string[]
}

interface IdentityData {
  name: string
  personality: string
  content: string
}

interface AgentConfig {
  role?: string
  provider?: string
  model?: string
  temperature?: number
  thinking?: boolean
  tools?: string[]
  skills?: string[]
  avatar_preset?: string
  [key: string]: unknown
}

const FALLBACK_TEMPERATURE = 0.7

function labelOrFallback(value: string | undefined, fallback: string) {
  const text = value?.trim()
  return text || fallback
}

function uniqueItems(...groups: Array<string[] | undefined>) {
  return Array.from(new Set(groups.flatMap((group) => group ?? []).filter(Boolean)))
}

function parseListInput(value: string) {
  return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean)
}

function templateAvatar(template: AgentTemplateInfo, config: AgentConfig | null) {
  if (template.avatar_url) return template.avatar_url
  const preset = config?.avatar_preset || template.avatar_preset
  return preset ? `/avatars/agents/${preset}.svg` : ''
}

export function AgentManageTab() {
  const { api } = useBeeSeedContext()
  const [templates, setTemplates] = useState<AgentTemplateInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const loadSeqRef = useRef(0)
  const detailSeqRef = useRef(0)

  const loadTemplates = useCallback(async () => {
    const loadSeq = loadSeqRef.current + 1
    loadSeqRef.current = loadSeq
    setLoading(true)

    try {
      const data = await api.get('admin/agent-templates').json<AgentTemplateInfo[]>()
      if (loadSeqRef.current !== loadSeq) return

      const nextTemplates = data ?? []
      setTemplates(nextTemplates)
      setSelectedId((current) => (
        current && nextTemplates.some((template) => template.id === current)
          ? current
          : nextTemplates[0]?.id ?? null
      ))
    } catch {
      if (loadSeqRef.current === loadSeq) {
        setTemplates([])
        setSelectedId(null)
      }
    } finally {
      if (loadSeqRef.current === loadSeq) {
        setLoading(false)
      }
    }
  }, [api])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (!selectedId) {
      setIdentity(null)
      setAgentConfig(null)
      return
    }

    const detailSeq = detailSeqRef.current + 1
    detailSeqRef.current = detailSeq
    setIdentity(null)
    setAgentConfig(null)
    setSaved(false)
    setSaveError('')

    Promise.all([
      api.get(`admin/agent-templates/${selectedId}/identity`).json<IdentityData>().catch(() => null),
      api.get(`admin/agent-templates/${selectedId}/config`).json<AgentConfig>().catch(() => null),
    ]).then(([id, cfg]) => {
      if (detailSeqRef.current !== detailSeq) return
      setIdentity(id)
      setAgentConfig(cfg ? { ...cfg, tools: cfg.tools ?? [], skills: cfg.skills ?? [] } : null)
    })
  }, [api, selectedId])

  const updateIdentity = (patch: Partial<IdentityData>) => {
    setIdentity((current) => ({ name: '', personality: '', content: '', ...(current ?? {}), ...patch }))
    setSaved(false)
    setSaveError('')
  }

  const updateConfig = (patch: Partial<AgentConfig>) => {
    setAgentConfig((current) => ({ ...(current ?? {}), ...patch }))
    setSaved(false)
    setSaveError('')
  }

  const saveTemplate = async () => {
    if (!selectedId || !identity || !agentConfig) return
    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      const identityPayload = {
        name: identity.name.trim(),
        personality: identity.personality.trim(),
        content: identity.content,
      }
      const configPayload = {
        ...agentConfig,
        role: selectedId,
        identity: {
          ...((agentConfig.identity as Record<string, unknown> | undefined) ?? {}),
          ...identityPayload,
        },
      }
      await api.put(`admin/agent-templates/${selectedId}/config`, { json: configPayload })
      await api.put(`admin/agent-templates/${selectedId}/identity`, { json: identityPayload })
      setTemplates((current) => current.map((template) => (
        template.id === selectedId
          ? {
              ...template,
              name: identityPayload.name || template.name,
              role: String(configPayload.role || template.role),
              provider: String(configPayload.provider || template.provider),
              model: String(configPayload.model || template.model),
              tools: configPayload.tools ?? template.tools,
              skills: configPayload.skills ?? template.skills,
            }
          : template
      )))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const selectedTemplate = selectedId ? templates.find((template) => template.id === selectedId) ?? null : null
  const displayName = labelOrFallback(identity?.name || selectedTemplate?.name, selectedTemplate?.id || 'Agent')
  const role = labelOrFallback(agentConfig?.role || selectedTemplate?.role, selectedTemplate?.id || 'agent')
  const provider = labelOrFallback(agentConfig?.provider || selectedTemplate?.provider, '-')
  const model = labelOrFallback(agentConfig?.model || selectedTemplate?.model, '-')
  const temperature = typeof agentConfig?.temperature === 'number' ? agentConfig.temperature : FALLBACK_TEMPERATURE
  const tools = uniqueItems(agentConfig?.tools, selectedTemplate?.tools)
  const skills = uniqueItems(agentConfig?.skills, selectedTemplate?.skills)
  const avatarUrl = selectedTemplate ? templateAvatar(selectedTemplate, agentConfig) : ''

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
              <p className="mt-1 text-sm text-muted-foreground">{templates.length} 个 Agent 模板</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-sm font-semibold text-[#1a1a1a]">Agent 模板</h3>
              </div>
              <div className="max-h-[640px] space-y-2 overflow-y-auto p-3">
                {templates.length === 0 ? (
                  <div className="rounded-lg border border-border p-3 text-xs leading-5 text-muted-foreground">
                    暂无 Agent 模板
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
                      <div className="truncate text-sm font-medium text-[#1a1a1a]">{labelOrFallback(template.name, template.id)}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{labelOrFallback(template.role, template.id)}</div>
                      {template.model && <div className="mt-0.5 truncate text-xs text-muted-foreground">{template.model}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              {selectedTemplate ? (
                <>
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#1a1a1a]">{displayName}</h3>
                      <span className="text-xs text-muted-foreground">
                        {role} · Template ID: {selectedTemplate.id}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveTemplate()}
                      disabled={saving || !identity || !agentConfig}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#181d26] px-3 text-sm font-medium text-white transition-colors hover:bg-[#0d1218] disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? '保存中...' : saved ? '已保存' : '保存'}
                    </button>
                  </div>

                  <div className="space-y-5 p-5">
                    {saveError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {saveError}
                      </div>
                    )}

                    {avatarUrl && (
                      <div>
                        <label className="mb-2 block text-xs font-medium text-[#555]">头像</label>
                        <div className="flex h-10 w-10 overflow-hidden rounded-full border border-border bg-[#181d26]/10">
                          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">名字</label>
                        <input
                          type="text"
                          value={identity?.name ?? displayName}
                          onChange={(event) => updateIdentity({ name: event.target.value })}
                          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">模型</label>
                        <input
                          type="text"
                          value={model}
                          onChange={(event) => updateConfig({ model: event.target.value })}
                          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">性格特点</label>
                      <input
                        type="text"
                        value={identity?.personality ?? ''}
                        onChange={(event) => updateIdentity({ personality: event.target.value })}
                        className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">Provider</label>
                        <input
                          type="text"
                          value={provider}
                          onChange={(event) => updateConfig({ provider: event.target.value })}
                          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">
                          Temperature: {temperature.toFixed(1)}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={temperature}
                          onChange={(event) => updateConfig({ temperature: Number(event.target.value) })}
                          className="h-9 w-full"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-[#555]">
                      <input
                        type="checkbox"
                        checked={Boolean(agentConfig?.thinking)}
                        onChange={(event) => updateConfig({ thinking: event.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                      启用 Thinking（深度思考模式）
                    </label>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">工具</label>
                      <textarea
                        value={tools.join(', ')}
                        onChange={(event) => updateConfig({ tools: parseListInput(event.target.value) })}
                        className="h-20 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">技能</label>
                      <textarea
                        value={skills.join(', ')}
                        onChange={(event) => updateConfig({ skills: parseListInput(event.target.value) })}
                        className="h-16 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                      />
                    </div>

                    <details className="text-xs">
                      <summary className="mb-1.5 cursor-pointer select-none text-muted-foreground">Identity 原始内容（高级）</summary>
                      <textarea
                        value={identity?.content ?? ''}
                        onChange={(event) => updateIdentity({ content: event.target.value })}
                        className="h-36 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                      />
                    </details>
                  </div>
                </>
              ) : (
                <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
                  选择一个 Agent 模板
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
