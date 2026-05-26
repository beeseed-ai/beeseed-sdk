import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, BookOpen, MessageSquare, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import type { KnowledgeBase } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Badge } from '../ui/badge.js'

interface AgentTemplateOption {
  id: string
  name: string
  role?: string
  version?: string
  avatar_url?: string
  avatar_preset?: string
}

interface ChannelTemplate {
  id?: string
  type: 'create' | 'join'
  channel_id?: string
  sort_order?: number
  name: string
  description?: string
  icon?: string
  agents: string[]
  knowledge?: string[]
  welcome_message?: string
  storage?: {
    enabled?: boolean
    visibility?: string
    members_can_upload?: boolean
    members_can_delete_own?: boolean
  }
}

interface ChannelSettingsResponse {
  mode: 'all_users' | 'admin_only' | 'owner_only' | 'disabled'
  default_agent_ids: string[]
  max_channels_per_user: number
  require_purpose: boolean
  default_channel_type: string
  channel_templates?: ChannelTemplate[]
  available_agents?: AgentTemplateOption[]
}

interface KnowledgeBasesResponse {
  bases?: KnowledgeBase[]
}

interface ApplyTemplatesResponse {
  users_processed: number
  channels_created: number
  channels_deleted?: number
  members_joined: number
  failed: number
}

const DEFAULT_POLICY: Omit<ChannelSettingsResponse, 'channel_templates' | 'available_agents'> = {
  mode: 'all_users',
  default_agent_ids: ['assistant'],
  max_channels_per_user: 0,
  require_purpose: false,
  default_channel_type: 'create',
}

function newChannelTemplate(): ChannelTemplate {
  return {
    id: createTemplateId(),
    type: 'create',
    name: '新频道模板',
    description: '',
    icon: 'bot',
    agents: ['assistant'],
    knowledge: [],
    welcome_message: '你好！有什么可以帮你的？',
  }
}

function createTemplateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTemplates(templates: ChannelTemplate[] | undefined): ChannelTemplate[] {
  const items = templates ?? [newChannelTemplate()]
  return items.map((template, index) => ({
    id: template.id || createTemplateId(),
    type: template.type === 'join' ? 'join' : 'create',
    channel_id: template.channel_id ?? '',
    sort_order: index,
    name: template.name?.trim() || '新频道模板',
    description: template.description ?? '',
    icon: template.icon || 'bot',
    agents: template.agents?.length ? template.agents : ['assistant'],
    knowledge: template.knowledge ?? [],
    welcome_message: template.welcome_message ?? '',
    storage: template.storage,
  }))
}

function agentLabel(agentId: string, agents: AgentTemplateOption[]) {
  const agent = agents.find((item) => item.id === agentId)
  return agent?.name || agent?.role || agentId
}

function knowledgeLabel(knowledgeId: string, bases: KnowledgeBase[]) {
  const base = bases.find((item) => item.id === knowledgeId)
  return base?.display_name || base?.name || knowledgeId
}

function isManagedDefaultKnowledgeBase(base: KnowledgeBase) {
  return base.name === 'default' && (
    base.description === 'Default app knowledge base'
      || base.description === 'Default channel knowledge base'
  )
}

function isTemplateSelectableKnowledgeBase(base: KnowledgeBase) {
  return base.is_active !== false
    && !isManagedDefaultKnowledgeBase(base)
    && !base.channel_id
    && (base.scope_type === 'app' || base.scope_type === 'organization' || base.scope_type === 'platform')
}

function knowledgeScopeLabel(scope: KnowledgeBase['scope_type']) {
  if (scope === 'app') return 'App'
  if (scope === 'organization') return '组织'
  if (scope === 'platform') return '平台'
  return '频道'
}

function toggleItem(items: string[], item: string) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item]
}

export function ChannelManageTab() {
  const { api, channelsStore } = useBeeSeedContext()
  const [policy, setPolicy] = useState(DEFAULT_POLICY)
  const [templates, setTemplates] = useState<ChannelTemplate[]>([])
  const [availableAgents, setAvailableAgents] = useState<AgentTemplateOption[]>([])
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<ApplyTemplatesResponse | null>(null)
  const [error, setError] = useState('')

  const selectedTemplate = templates[selectedIndex] ?? null
  const selectedAgents = selectedTemplate?.agents ?? []
  const selectableKnowledgeIds = useMemo(() => new Set(availableKnowledgeBases.map((base) => base.id)), [availableKnowledgeBases])
  const selectedKnowledge = useMemo(
    () => (selectedTemplate?.knowledge ?? []).filter((knowledgeId) => selectableKnowledgeIds.has(knowledgeId)),
    [selectableKnowledgeIds, selectedTemplate],
  )

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('admin/settings/channels').json<ChannelSettingsResponse>()
      setPolicy({
        mode: data.mode || DEFAULT_POLICY.mode,
        default_agent_ids: data.default_agent_ids ?? DEFAULT_POLICY.default_agent_ids,
        max_channels_per_user: data.max_channels_per_user ?? DEFAULT_POLICY.max_channels_per_user,
        require_purpose: Boolean(data.require_purpose),
        default_channel_type: data.default_channel_type || DEFAULT_POLICY.default_channel_type,
      })
      const nextTemplates = normalizeTemplates(data.channel_templates)
      setTemplates(nextTemplates)
      setAvailableAgents(data.available_agents ?? [])
      setSelectedIndex((current) => Math.min(current, Math.max(0, nextTemplates.length - 1)))
      setDirty(false)
      setApplyResult(null)
      void api.get('knowledge/bases').json<KnowledgeBasesResponse>()
        .then((knowledgeData) => {
          setAvailableKnowledgeBases((knowledgeData.bases ?? []).filter(isTemplateSelectableKnowledgeBase))
        })
        .catch(() => setAvailableKnowledgeBases([]))
    } catch {
      setError('频道模板加载失败')
      setTemplates([])
      setAvailableAgents([])
      setAvailableKnowledgeBases([])
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const templateAgents = useMemo(() => {
    if (!selectedTemplate) return []
    return selectedTemplate.agents.map((agentId) => ({
      id: agentId,
      label: agentLabel(agentId, availableAgents),
    }))
  }, [availableAgents, selectedTemplate])

  const templateKnowledgeBases = useMemo(() => {
    if (!selectedTemplate) return []
    return selectedKnowledge.map((knowledgeId) => ({
      id: knowledgeId,
      label: knowledgeLabel(knowledgeId, availableKnowledgeBases),
    }))
  }, [availableKnowledgeBases, selectedKnowledge, selectedTemplate])

  function updateTemplate(patch: Partial<ChannelTemplate>) {
    setTemplates((current) => current.map((template, index) => (
      index === selectedIndex ? { ...template, ...patch } : template
    )))
    setDirty(true)
    setSaved(false)
    setError('')
  }

  function addTemplate() {
    const template = newChannelTemplate()
    setTemplates((current) => {
      setSelectedIndex(current.length)
      return [...current, template]
    })
    setDirty(true)
    setSaved(false)
  }

  function deleteTemplate(index: number) {
    setTemplates((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index)
      setSelectedIndex((selected) => Math.min(selected, Math.max(0, next.length - 1)))
      return next
    })
    setDirty(true)
    setSaved(false)
  }

  function moveTemplate(index: number, direction: -1 | 1) {
    setTemplates((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(targetIndex, 0, item)
      setSelectedIndex((selected) => {
        if (selected === index) return targetIndex
        if (selected === targetIndex) return index
        return selected
      })
      return next
    })
    setDirty(true)
    setSaved(false)
    setError('')
  }

  function toggleAgent(agentId: string) {
    if (!selectedTemplate) return
    const agents = toggleItem(selectedTemplate.agents, agentId)
    updateTemplate({ agents: agents.length > 0 ? agents : ['assistant'] })
  }

  function toggleKnowledgeBase(knowledgeId: string) {
    if (!selectedTemplate) return
    updateTemplate({ knowledge: toggleItem(selectedKnowledge, knowledgeId) })
  }

  async function applyTemplatesToExistingUsers() {
    setApplying(true)
    setError('')
    setApplyResult(null)
    try {
      if (dirty) {
        setError('请先保存频道模板后再同步到已有用户')
        return
      }
      const result = await api.post('admin/settings/channels/apply-templates').json<ApplyTemplatesResponse>()
      setApplyResult(result)
      void channelsStore.getState().fetchChannels()
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步频道模板失败')
    } finally {
      setApplying(false)
    }
  }

  async function saveTemplates() {
    if (!dirty) return
    setSaving(true)
    setError('')
    try {
      const invalidJoinTemplate = templates.find((template) => template.type === 'join' && !template.channel_id?.trim())
      if (invalidJoinTemplate) {
        setError(`模板「${invalidJoinTemplate.name || '未命名模板'}」需要填写目标频道 ID`)
        return
      }
      const cleanTemplates = normalizeTemplates(templates).map((template, index) => ({
        ...template,
        id: template.id || createTemplateId(),
        sort_order: index,
        channel_id: template.type === 'join' ? template.channel_id?.trim() : '',
        name: template.name.trim() || '新频道模板',
        description: template.description?.trim() || '',
        icon: template.icon?.trim() || 'bot',
        knowledge: (template.knowledge ?? []).filter((knowledgeId) => selectableKnowledgeIds.has(knowledgeId)),
        welcome_message: template.welcome_message?.trim() || '',
      }))
      const savedSettings = await api.patch('admin/settings/channels', {
        json: {
          ...policy,
          channel_templates: cleanTemplates,
        },
      }).json<ChannelSettingsResponse>()
      const nextTemplates = normalizeTemplates(savedSettings.channel_templates)
      setPolicy({
        mode: savedSettings.mode || policy.mode,
        default_agent_ids: savedSettings.default_agent_ids ?? policy.default_agent_ids,
        max_channels_per_user: savedSettings.max_channels_per_user ?? policy.max_channels_per_user,
        require_purpose: Boolean(savedSettings.require_purpose),
        default_channel_type: savedSettings.default_channel_type || policy.default_channel_type,
      })
      setTemplates(nextTemplates)
      setAvailableAgents(savedSettings.available_agents ?? availableAgents)
      setSelectedIndex((current) => Math.min(current, Math.max(0, nextTemplates.length - 1)))
      setDirty(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : '频道模板保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-[#999]">加载中...</div>
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#1a1a1a]">频道管理</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {templates.length} 个频道模板
                {applyResult && (
                  <span className="ml-2">
                    已同步 {applyResult.users_processed} 个用户，新增 {applyResult.channels_created} 个频道，删除 {applyResult.channels_deleted ?? 0} 个频道
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void applyTemplatesToExistingUsers()}
              disabled={applying || saving}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-medium text-[#181d26] transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', applying && 'animate-spin')} />
              {applying ? '同步中...' : '同步到已有用户'}
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-sm font-semibold text-[#1a1a1a]">频道模板</h3>
                <button
                  type="button"
                  onClick={addTemplate}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-[#181d26] transition-colors hover:bg-muted"
                  title="添加频道模板"
                  aria-label="添加频道模板"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {error && (
                <div className="mx-3 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
              <div className="max-h-[640px] space-y-2 overflow-y-auto p-3">
                {templates.length === 0 ? (
                  <div className="rounded-lg border border-border p-3 text-xs leading-5 text-muted-foreground">
                    暂无频道模板
                  </div>
                ) : templates.map((template, index) => (
                  <div
                    key={template.id || `${template.name}-${index}`}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg border p-2 transition-colors',
                      selectedIndex === index ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#181d26]/10">
                        <MessageSquare className="h-4 w-4 text-[#181d26]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[#1a1a1a]">{template.name || '未命名模板'}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          #{index + 1} · {template.type === 'join' ? '加入已有频道' : '创建频道'} · {template.agents.length} Agent
                          {template.knowledge?.length ? ` · ${template.knowledge.length} 知识库` : ''}
                        </div>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveTemplate(index, -1)}
                        disabled={index === 0}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white hover:text-[#181d26] disabled:pointer-events-none disabled:opacity-35"
                        title="上移"
                        aria-label={`上移模板 ${template.name || '未命名模板'}`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTemplate(index, 1)}
                        disabled={index === templates.length - 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white hover:text-[#181d26] disabled:pointer-events-none disabled:opacity-35"
                        title="下移"
                        aria-label={`下移模板 ${template.name || '未命名模板'}`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(index)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white hover:text-red-600"
                      title="删除模板"
                      aria-label="删除模板"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              {selectedTemplate ? (
                <>
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#1a1a1a]">{selectedTemplate.name || '未命名模板'}</h3>
                      <span className="text-xs text-muted-foreground">
                        {selectedTemplate.type === 'join' ? '加入已有频道' : '创建频道'} · 默认 {selectedAgents.length} 个 Agent
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveTemplates()}
                      disabled={saving || !dirty}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#181d26] px-3 text-sm font-medium text-white transition-colors hover:bg-[#0d1218] disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? '保存中...' : saved ? '已保存' : '保存'}
                    </button>
                  </div>

                  <div className="space-y-5 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">模板名称</label>
                        <Input value={selectedTemplate.name} onChange={(event) => updateTemplate({ name: event.target.value })} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">类型</label>
                        <select
                          value={selectedTemplate.type}
                          onChange={(event) => updateTemplate({ type: event.target.value === 'join' ? 'join' : 'create' })}
                          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                        >
                          <option value="create">创建新频道</option>
                          <option value="join">加入已有频道</option>
                        </select>
                      </div>
                    </div>

                    {selectedTemplate.type === 'join' && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">目标频道 ID</label>
                        <Input value={selectedTemplate.channel_id ?? ''} onChange={(event) => updateTemplate({ channel_id: event.target.value })} />
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">描述</label>
                      <Input value={selectedTemplate.description ?? ''} onChange={(event) => updateTemplate({ description: event.target.value })} />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">欢迎消息</label>
                      <textarea
                        value={selectedTemplate.welcome_message ?? ''}
                        onChange={(event) => updateTemplate({ welcome_message: event.target.value })}
                        rows={4}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border border-border bg-[#fafafa] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-[#181d26]">默认 Agent</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{templateAgents.map((item) => item.label).join('、') || 'assistant'}</div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">{selectedAgents.length}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableAgents.map((agent) => {
                          const active = selectedAgents.includes(agent.id)
                          return (
                            <Button
                              key={agent.id}
                              type="button"
                              variant={active ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleAgent(agent.id)}
                            >
                              {agent.name || agent.role || agent.id}
                            </Button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-border bg-[#fafafa] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-[#181d26]">默认检索知识库</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {templateKnowledgeBases.map((item) => item.label).join('、') || '仅使用频道知识库'}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">{selectedKnowledge.length}</Badge>
                      </div>
                      {availableKnowledgeBases.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border bg-white px-3 py-2 text-xs text-muted-foreground">
                          暂无可选择的 App、组织或平台知识库
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {availableKnowledgeBases.map((base) => {
                            const active = selectedKnowledge.includes(base.id)
                            return (
                              <Button
                                key={base.id}
                                type="button"
                                variant={active ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => toggleKnowledgeBase(base.id)}
                              >
                                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                                {knowledgeScopeLabel(base.scope_type)} · {base.display_name || base.name}
                              </Button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">选择一个频道模板</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
