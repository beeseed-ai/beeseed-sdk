import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import Graph from 'graphology'
import {
  BookOpen, Check, Database, Eye, EyeOff, FileText, FolderOpen, GitFork, Loader2,
  Maximize2, Package, Pause, Play, Plus, RefreshCw, Search, Trash2, Upload,
  X, ZoomIn, ZoomOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ChannelWithMeta, KnowledgeBase, KnowledgeSource, KnowledgeSubscription } from '../../core/types.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { cn } from '../../lib/cn.js'
import { formatBytes } from '../../lib/format.js'
import { useKnowledgeGraphSigma } from '../../hooks/useKnowledgeGraphSigma.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Badge } from '../ui/badge.js'

type KnowledgeBasesResponse = { bases: KnowledgeBase[] }
type KnowledgeSubscriptionsResponse = { subscriptions: KnowledgeSubscription[] }
type ChannelKnowledgeOverview = {
  settings?: {
    enabled?: boolean
    auto_distill?: boolean
    channel_knowledge_base_id?: string
    last_distilled_message_id?: number
  }
  progress?: {
    last_message_id?: number
    consecutive_failures?: number
    last_error?: string
  }
}
type KnowledgeGraphEntity = {
  id: number
  name: string
  entity_type: string
  description?: string
  aliases?: string[]
  mention_count?: number
}
type KnowledgeGraphRelation = {
  id?: number
  source_entity_id: number
  target_entity_id: number
  relation_type: string
  description?: string
  weight?: number
}
type KnowledgeGraphEntitySource = {
  entity_id: number
  source_id: number
  excerpt?: string
}
export type ChannelKnowledgeGraphData = {
  sources?: KnowledgeSource[]
  entities: KnowledgeGraphEntity[]
  relations: KnowledgeGraphRelation[]
  entity_sources?: KnowledgeGraphEntitySource[]
}
type KnowledgeGraphData = ChannelKnowledgeGraphData
export type KnowledgeGraphSelection =
  | { type: 'source'; source: KnowledgeSource }
  | { type: 'entity'; entity: KnowledgeGraphEntity }
  | null
type Selection = KnowledgeGraphSelection

type SigmaNode = {
  id: string
  title: string
  node_type: 'source' | 'entity'
  source_type?: string
  entity_type?: string
  chunk_count?: number
  mention_count?: number
}

type SigmaEdge = {
  source: string
  target: string
  type: string
  weight: number
}

type SigmaData = {
  nodes: SigmaNode[]
  edges: SigmaEdge[]
}

const ACTIVE_SOURCE_STATUSES = new Set(['pending', 'processing'])
const SUPPORTED_KNOWLEDGE_UPLOAD_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.jsonl', '.csv', '.tsv', '.yaml', '.yml',
  '.html', '.htm', '.xml', '.log', '.pdf', '.docx', '.docm', '.xlsx', '.xlsm',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp',
])
const SUPPORTED_KNOWLEDGE_UPLOAD_ACCEPT = Array.from(SUPPORTED_KNOWLEDGE_UPLOAD_EXTENSIONS).join(',')
const SUPPORTED_OFFICE_UPLOAD_MIME_PARTS = [
  'wordprocessingml.document',
  'wordprocessingml.template',
  'spreadsheetml.sheet',
  'spreadsheetml.template',
  'ms-word.document.macroenabled.12',
  'ms-excel.sheet.macroenabled.12',
]
const SOURCE_COLORS: Record<string, string> = {
  file_upload: '#0891b2',
  knowledge_pack: '#059669',
  chat_distillation: '#7c3aed',
  answer_writeback: '#d97706',
}
const EDGE_COLORS: Record<string, string> = {
  shared_tags: '#38bdf8',
  supersedes: '#fb923c',
  conversation: '#818cf8',
  mentioned_in: '#a78bfa',
}
const RELATION_PALETTE = [
  '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd',
  '#67e8f9', '#5eead4', '#86efac', '#fde68a',
  '#fdba74', '#fca5a5', '#f9a8d4', '#d8b4fe',
]
const ENTITY_PALETTE = [
  '#f43f5e', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
  '#e11d48', '#84cc16', '#0ea5e9', '#d97706', '#7c3aed',
  '#fb7185', '#34d399', '#60a5fa', '#fbbf24', '#c084fc',
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getEntityColor(entityType: string): string {
  if (!entityType) return '#64748b'
  return ENTITY_PALETTE[hashString(entityType) % ENTITY_PALETTE.length]
}

function getRelationColor(relationType: string): string {
  if (!relationType) return '#94a3b8'
  return RELATION_PALETTE[hashString(relationType) % RELATION_PALETTE.length]
}

function getGraphSourceSignature(sources: KnowledgeSource[]): string {
  return sources
    .map((source) => [source.id, source.title, source.source_type, source.chunk_count].join(':'))
    .join('|')
}

function hasNewReadySource(previous: KnowledgeSource[], next: KnowledgeSource[]): boolean {
  const previousByID = new Map(previous.map((source) => [source.id, source]))
  return next.some((source) => {
    const before = previousByID.get(source.id)
    if (!before) return source.status === 'ready'
    if (source.status !== 'ready') return false
    return before.status !== 'ready' || before.chunk_count !== source.chunk_count
  })
}

function isSupportedKnowledgeUploadFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const dotIndex = name.lastIndexOf('.')
  const ext = dotIndex >= 0 ? name.slice(dotIndex) : ''
  if (SUPPORTED_KNOWLEDGE_UPLOAD_EXTENSIONS.has(ext)) return true
  const mimeType = file.type.toLowerCase()
  if (SUPPORTED_OFFICE_UPLOAD_MIME_PARTS.some((part) => mimeType.includes(part))) return true
  if (mimeType.includes('openxmlformats-officedocument')) return false
  return mimeType.startsWith('text/') ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('image/') ||
    mimeType.includes('json') ||
    mimeType.includes('yaml') ||
    mimeType.endsWith('/xml') ||
    mimeType.includes('+xml')
}

function normalizeGraphData(graph: KnowledgeGraphData | null | undefined): KnowledgeGraphData {
  return {
    sources: graph?.sources ?? [],
    entities: graph?.entities ?? [],
    relations: graph?.relations ?? [],
    entity_sources: graph?.entity_sources ?? [],
  }
}

export function KnowledgeManageTab() {
  const { api } = useBeeSeedContext()
  const fileRef = useRef<HTMLInputElement>(null)
  const directoryRef = useRef<HTMLInputElement>(null)
  const sourcesRef = useRef<KnowledgeSource[]>([])
  const [bases, setBases] = useState<KnowledgeBase[]>([])
  const [subscribableBases, setSubscribableBases] = useState<KnowledgeBase[]>([])
  const [subscriptions, setSubscriptions] = useState<KnowledgeSubscription[]>([])
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [channels, setChannels] = useState<ChannelWithMeta[]>([])
  const [selectedBaseId, setSelectedBaseId] = useState('')
  const [selectedScope, setSelectedScope] = useState<'app' | 'channel'>('app')
  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [loading, setLoading] = useState(false)
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [graphLoading, setGraphLoading] = useState(false)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionWorkingId, setSubscriptionWorkingId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleteBaseTarget, setDeleteBaseTarget] = useState<KnowledgeBase | null>(null)
  const [deletingBaseId, setDeletingBaseId] = useState('')
  const [deletingSourceId, setDeletingSourceId] = useState<number | null>(null)
  const [distilling, setDistilling] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [newName, setNewName] = useState('')
  const [channelQuery, setChannelQuery] = useState('')
  const [selection, setSelection] = useState<Selection>(null)
  const [channelOverview, setChannelOverview] = useState<ChannelKnowledgeOverview | null>(null)
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null)
  const [uploadNotice, setUploadNotice] = useState('')

  const appBases = useMemo(() => bases.filter((base) => base.scope_type === 'app'), [bases])
  const channelBases = useMemo(() => bases.filter((base) => base.scope_type === 'channel'), [bases])
  const subscribedBaseIds = useMemo(() => new Set(subscriptions.map((subscription) => subscription.knowledge_base_id)), [subscriptions])
  const externalBases = useMemo(() => {
    const byId = new Map<string, KnowledgeBase>()
    subscribableBases.forEach((base) => {
      if (base.scope_type === 'organization' || base.scope_type === 'platform') byId.set(base.id, base)
    })
    subscriptions.forEach((subscription) => {
      if (subscription.knowledge_base.scope_type === 'organization' || subscription.knowledge_base.scope_type === 'platform') {
        byId.set(subscription.knowledge_base.id, subscription.knowledge_base)
      }
    })
    return Array.from(byId.values()).sort((a, b) => {
      const scopeOrder = (scope: KnowledgeBase['scope_type']) => scope === 'platform' ? 0 : scope === 'organization' ? 1 : 2
      return scopeOrder(a.scope_type) - scopeOrder(b.scope_type)
        || (a.display_name || a.name).localeCompare(b.display_name || b.name)
    })
  }, [subscribableBases, subscriptions])
  const selectedBase = bases.find((base) => base.id === selectedBaseId) ?? null
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null
  const filteredChannels = useMemo(() => {
    const query = channelQuery.trim().toLowerCase()
    const list = query
      ? channels.filter((channel) => [
        channel.name || '未命名频道',
        channel.owner_name || '',
        channel.owner_email || '',
      ].join(' ').toLowerCase().includes(query))
      : channels
    return list.slice(0, 50)
  }, [channelQuery, channels])
  const hasActiveSources = sources.some((source) => ACTIVE_SOURCE_STATUSES.has(source.status))

  const loadBases = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true)
    try {
      const data = await api.get('knowledge/bases').json<KnowledgeBasesResponse>()
      const nextBases = data.bases ?? []
      setBases(nextBases)
      setSelectedBaseId((current) => {
        if (current && nextBases.some((base) => base.id === current)) return current
        return nextBases.find((base) => base.scope_type === 'app')?.id || ''
      })
    } finally {
      if (!options.silent) setLoading(false)
    }
  }, [api])

  const loadChannels = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setChannelsLoading(true)
    try {
      const data = await api.get('admin/channels').json<ChannelWithMeta[]>()
      setChannels(data ?? [])
    } finally {
      if (!options.silent) setChannelsLoading(false)
    }
  }, [api])

  const loadSubscriptionCatalog = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setSubscriptionLoading(true)
    try {
      const [baseData, subscriptionData] = await Promise.all([
        api.get('knowledge/subscribable-bases').json<KnowledgeBasesResponse>(),
        api.get('knowledge/subscriptions').json<KnowledgeSubscriptionsResponse>(),
      ])
      setSubscribableBases(baseData.bases ?? [])
      setSubscriptions(subscriptionData.subscriptions ?? [])
    } finally {
      if (!options.silent) setSubscriptionLoading(false)
    }
  }, [api])

  const loadGraph = useCallback(async (knowledgeBaseId = selectedBaseId, channelId = selectedChannelId) => {
    if (!knowledgeBaseId && !channelId) {
      setGraphData(null)
      return
    }
    setGraphLoading(true)
    try {
      const data = selectedScope === 'channel' && channelId
        ? await api.get(`channels/${channelId}/knowledge/graph`).json<KnowledgeGraphData>()
        : await api.get('knowledge/graph', { searchParams: { kb_id: knowledgeBaseId } }).json<KnowledgeGraphData>()
      setGraphData(normalizeGraphData(data))
    } finally {
      setGraphLoading(false)
    }
  }, [api, selectedBaseId, selectedChannelId, selectedScope])

  const loadSources = useCallback(async (knowledgeBaseId = selectedBaseId, options: { silent?: boolean; refreshGraphOnReady?: boolean } = {}) => {
    if (!knowledgeBaseId) {
      setSources([])
      sourcesRef.current = []
      return
    }
    if (!options.silent) setSourceLoading(true)
    try {
      const data = await api.get('knowledge/sources', { searchParams: { kb_id: knowledgeBaseId } }).json<KnowledgeSource[] | { sources: KnowledgeSource[] }>()
      const nextSources = Array.isArray(data) ? data : data.sources ?? []
      const shouldRefreshGraph = Boolean(options.refreshGraphOnReady && hasNewReadySource(sourcesRef.current, nextSources))
      setSources(nextSources)
      sourcesRef.current = nextSources
      if (shouldRefreshGraph) {
        void loadGraph(knowledgeBaseId)
      }
    } finally {
      if (!options.silent) setSourceLoading(false)
    }
  }, [api, loadGraph, selectedBaseId])

  const loadChannelOverview = useCallback(async (channelId: string, options: { selectBase?: boolean } = {}) => {
    if (!channelId) {
      setChannelOverview(null)
      return null
    }
    const data = await api.get(`channels/${channelId}/knowledge`).json<ChannelKnowledgeOverview>()
    setChannelOverview(data)
    const kbID = data.settings?.channel_knowledge_base_id
    if (options.selectBase && kbID) {
      setSelectedBaseId(kbID)
      await loadBases({ silent: true })
    }
    return data
  }, [api, loadBases])

  useEffect(() => { void loadBases() }, [])
  useEffect(() => { void loadChannels() }, [loadChannels])
  useEffect(() => { void loadSubscriptionCatalog() }, [loadSubscriptionCatalog])
  useEffect(() => {
    setGraphData(null)
    setSelection(null)
    setUploadNotice('')
    sourcesRef.current = []
    void loadSources(selectedBaseId)
  }, [loadSources, selectedBaseId])
  useEffect(() => {
    if (selectedBase?.scope_type !== 'channel' || !selectedBase.channel_id) {
      setChannelOverview(null)
      return
    }
    let active = true
    loadChannelOverview(selectedBase.channel_id).then((data) => {
      if (active) setChannelOverview(data)
    }).catch(() => {
      if (active) setChannelOverview(null)
    })
    return () => { active = false }
  }, [loadChannelOverview, selectedBase?.id, selectedBase?.scope_type, selectedBase?.channel_id])
  useEffect(() => {
    void loadGraph()
  }, [loadGraph])
  useEffect(() => {
    if (!hasActiveSources && !uploading && !distilling) return
    const timer = window.setInterval(() => {
      if (selectedBaseId) void loadSources(selectedBaseId, { silent: true, refreshGraphOnReady: true })
      void loadBases({ silent: true })
      void loadSubscriptionCatalog({ silent: true })
      if (selectedBase?.scope_type === 'channel' && selectedBase.channel_id) {
        void loadChannelOverview(selectedBase.channel_id)
      }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [distilling, hasActiveSources, loadBases, loadChannelOverview, loadGraph, loadSources, selectedBase?.channel_id, selectedBase?.scope_type, selectedBaseId, uploading])

  const createBase = async () => {
    const displayName = newName.trim()
    if (!displayName) return
    const base = await api.post('knowledge/bases', {
      json: { display_name: displayName, category: 'general' },
    }).json<KnowledgeBase>()
    setBases((items) => [base, ...items])
    setSelectedBaseId(base.id)
    setSelectedScope('app')
    setNewName('')
  }

  const selectAppBase = (id: string) => {
    setSelectedScope('app')
    setSelectedChannelId('')
    setSelectedBaseId(id)
  }

  const selectBase = (base: KnowledgeBase) => {
    setSelectedScope('app')
    setSelectedChannelId('')
    setSelectedBaseId(base.id)
  }

  const selectChannel = async (channel: ChannelWithMeta) => {
    setSelectedScope('channel')
    setSelectedChannelId(channel.id)
    setSelectedBaseId('')
    setSources([])
    sourcesRef.current = []
    setGraphData(null)
    const overview = await loadChannelOverview(channel.id, { selectBase: true })
    const kbID = overview?.settings?.channel_knowledge_base_id
    if (kbID) {
      setSelectedBaseId(kbID)
      void loadSources(kbID)
    }
  }

  const uploadFiles = async (files: FileList | File[]) => {
    if (!selectedBase || files.length === 0) return
    const allFiles = Array.from(files)
    const supportedFiles = allFiles.filter(isSupportedKnowledgeUploadFile)
    const filteredCount = allFiles.length - supportedFiles.length
    setUploadNotice(`本次选择 ${allFiles.length} 个文件，过滤 ${filteredCount} 个不支持的文件。`)
    if (supportedFiles.length === 0) {
      if (fileRef.current) fileRef.current.value = ''
      if (directoryRef.current) directoryRef.current.value = ''
      return
    }
    setUploading(true)
    try {
      for (const file of supportedFiles) {
        const form = new FormData()
        form.set('file', file)
        form.set('knowledge_base_id', selectedBase.id)
        await api.post('knowledge/sources', { body: form }).json<KnowledgeSource>()
      }
      await Promise.all([loadBases(), loadSources(selectedBase.id, { refreshGraphOnReady: true })])
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      if (directoryRef.current) directoryRef.current.value = ''
    }
  }

  const deleteSource = async (source: KnowledgeSource) => {
    const confirmed = window.confirm(`确定删除「${source.title}」吗？删除后会同时移除它的分块、实体关联和图谱关系。`)
    if (!confirmed) return
    setDeletingSourceId(source.id)
    try {
      await api.delete(`knowledge/sources/${source.id}`)
      setSelection((current) => {
        if (current?.type === 'source' && current.source.id === source.id) return null
        return current
      })
      setSources((items) => {
        const next = items.filter((item) => item.id !== source.id)
        sourcesRef.current = next
        return next
      })
      await Promise.all([
        loadBases({ silent: true }),
        loadSources(selectedBaseId, { silent: true }),
        loadGraph(selectedBaseId),
      ])
    } finally {
      setDeletingSourceId(null)
    }
  }

  const deleteBase = async (base: KnowledgeBase) => {
    if (base.scope_type !== 'app' || base.name === 'default') return
    setDeletingBaseId(base.id)
    try {
      await api.delete(`knowledge/bases/${base.id}`).json<{ status: string }>()
      const nextSelectedID = selectedBaseId === base.id
        ? appBases.find((item) => item.id !== base.id)?.id || ''
        : selectedBaseId
      if (selectedBaseId === base.id) {
        setSelectedBaseId(nextSelectedID)
        setSelection(null)
        setGraphData(null)
        setSources([])
        sourcesRef.current = []
        if (nextSelectedID) {
          void loadSources(nextSelectedID)
        }
      }
      await Promise.all([
        loadBases({ silent: true }),
        loadSubscriptionCatalog({ silent: true }),
      ])
      setDeleteBaseTarget(null)
    } finally {
      setDeletingBaseId('')
    }
  }

  const subscribeBase = async (base: KnowledgeBase) => {
    setSubscriptionWorkingId(base.id)
    try {
      await api.post('knowledge/subscriptions', { json: { knowledge_base_id: base.id } }).json<KnowledgeSubscription>()
      await Promise.all([loadBases({ silent: true }), loadSubscriptionCatalog({ silent: true })])
    } finally {
      setSubscriptionWorkingId('')
    }
  }

  const unsubscribeBase = async (base: KnowledgeBase) => {
    setSubscriptionWorkingId(base.id)
    try {
      await api.delete(`knowledge/subscriptions/${base.id}`).json<{ status: string }>()
      await Promise.all([loadBases({ silent: true }), loadSubscriptionCatalog({ silent: true })])
      if (selectedBaseId === base.id) {
        setSelectedBaseId(appBases[0]?.id || '')
      }
    } finally {
      setSubscriptionWorkingId('')
    }
  }

  const distillChannel = async () => {
    if (selectedBase?.scope_type !== 'channel' || !selectedBase.channel_id) return
    setDistilling(true)
    try {
      await api.post(`channels/${selectedBase.channel_id}/knowledge/distill-now`, { json: { limit: 50 } }).json()
      await Promise.all([loadSources(selectedBase.id, { refreshGraphOnReady: true }), loadBases()])
      const overview = await api.get(`channels/${selectedBase.channel_id}/knowledge`).json<ChannelKnowledgeOverview>()
      setChannelOverview(overview)
    } finally {
      setDistilling(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="w-[360px] shrink-0 overflow-y-auto border-r border-border bg-white">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-[#1a1a1a]">知识库</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">App 私有资料与频道沉淀</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => void loadBases()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void createBase()}
              placeholder="新的 App 知识库"
              className="h-8"
            />
            <Button size="icon-sm" onClick={() => void createBase()} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中
          </div>
        ) : (
          <div className="p-3">
            <KnowledgeBaseGroup
              title="App 知识库"
              icon={Database}
              bases={appBases}
              selectedBaseId={selectedBaseId}
              onSelect={selectAppBase}
              onDelete={(base) => setDeleteBaseTarget(base)}
              deletingBaseId={deletingBaseId}
            />
            <ExternalKnowledgeGroup
              bases={externalBases}
              selectedBaseId={selectedBaseId}
              subscribedBaseIds={subscribedBaseIds}
              loading={subscriptionLoading}
              workingId={subscriptionWorkingId}
              onSelect={selectBase}
              onRefresh={() => void loadSubscriptionCatalog()}
              onSubscribe={(base) => void subscribeBase(base)}
              onUnsubscribe={(base) => void unsubscribeBase(base)}
            />
            <ChannelKnowledgePicker
              channels={filteredChannels}
              totalCount={channels.length}
              loading={channelsLoading}
              query={channelQuery}
              selectedChannelId={selectedChannelId}
              selectedBaseId={selectedBaseId}
              channelBases={channelBases}
              onQueryChange={setChannelQuery}
              onRefresh={() => void loadChannels()}
              onSelect={(channel) => void selectChannel(channel)}
            />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-[#1a1a1a]">{selectedBase?.display_name || '选择知识库'}</h2>
              {selectedBase && <ScopeBadge scope={selectedBase.scope_type} />}
            </div>
            {selectedBase && (
              <div className="mt-1 text-xs text-muted-foreground">
                {selectedScope === 'channel' && selectedChannel ? `${selectedChannel.name || '未命名频道'} · ` : ''}
                {selectedBase.source_count} 资料 · {selectedBase.chunk_count} 分块
                {selectedScope === 'channel' && selectedChannel?.owner_email ? ` · 所有者 ${selectedChannel.owner_name || selectedChannel.owner_email} ${selectedChannel.owner_name ? selectedChannel.owner_email : ''}` : ''}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadSources()}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {selectedBase ? (
            <KnowledgeWorkspace
              selectedBase={selectedBase}
              canEditSources={selectedBase.scope_type === 'app' || selectedBase.scope_type === 'channel'}
              sources={sources}
              sourceLoading={sourceLoading}
              deletingSourceId={deletingSourceId}
              graph={graphData}
              graphLoading={graphLoading}
              selection={selection}
              channelOverview={channelOverview}
              distilling={distilling}
              dragging={dragging}
              uploading={uploading}
              fileRef={fileRef}
              directoryRef={directoryRef}
              uploadNotice={uploadNotice}
              onSelect={setSelection}
              onRefreshGraph={() => void loadGraph()}
              onDistill={() => void distillChannel()}
              onDraggingChange={setDragging}
              onUpload={uploadFiles}
              onDeleteSource={deleteSource}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {selectedScope === 'channel' ? '请选择一个频道查看频道知识库' : '暂无可管理的知识库'}
            </div>
          )}
        </div>
      </div>

      {deleteBaseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-[#181d26]">删除知识库</h3>
                <p className="mt-1 text-xs text-muted-foreground">此操作无法撤销。</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeleteBaseTarget(null)}
                disabled={Boolean(deletingBaseId)}
                title="关闭"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm leading-6 text-[#333840]">
                确定删除「{deleteBaseTarget.display_name || deleteBaseTarget.name}」吗？删除后会同时移除其中资料、分块和知识图谱关系。
              </p>
              {deleteBaseTarget.source_count > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                  当前知识库包含 {deleteBaseTarget.source_count} 个资料、{deleteBaseTarget.chunk_count} 个分块。
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button
                variant="outline"
                onClick={() => setDeleteBaseTarget(null)}
                disabled={Boolean(deletingBaseId)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => void deleteBase(deleteBaseTarget)}
                disabled={Boolean(deletingBaseId)}
              >
                {deletingBaseId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KnowledgeWorkspace({
  selectedBase,
  canEditSources,
  sources,
  sourceLoading,
  deletingSourceId,
  graph,
  graphLoading,
  selection,
  channelOverview,
  distilling,
  dragging,
  uploading,
  fileRef,
  directoryRef,
  uploadNotice,
  onSelect,
  onRefreshGraph,
  onDistill,
  onDraggingChange,
  onUpload,
  onDeleteSource,
}: {
  selectedBase: KnowledgeBase
  canEditSources: boolean
  sources: KnowledgeSource[]
  sourceLoading: boolean
  deletingSourceId: number | null
  graph: KnowledgeGraphData | null
  graphLoading: boolean
  selection: Selection
  channelOverview: ChannelKnowledgeOverview | null
  distilling: boolean
  dragging: boolean
  uploading: boolean
  fileRef: RefObject<HTMLInputElement | null>
  directoryRef: RefObject<HTMLInputElement | null>
  uploadNotice: string
  onSelect: (selection: Selection) => void
  onRefreshGraph: () => void
  onDistill: () => void
  onDraggingChange: (value: boolean) => void
  onUpload: (files: FileList | File[]) => void
  onDeleteSource: (source: KnowledgeSource) => void
}) {
  const readyCount = sources.filter((source) => source.status === 'ready').length
  const failedCount = sources.filter((source) => source.status === 'failed' || source.status === 'error').length
  const processingCount = sources.filter((source) => source.status === 'pending' || source.status === 'processing').length
  const normalizedGraph = normalizeGraphData(graph)

  return (
    <div className="flex h-full min-h-[620px] flex-col overflow-hidden bg-[#f8f8fa]">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Package className="h-4 w-4 text-[#777169]" />
          <span className="truncate text-sm font-medium text-slate-950">
            {selectedBase.display_name || selectedBase.name}
          </span>
          <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px]">
            {getKnowledgeBaseScopeLabel(selectedBase.scope_type)}
          </Badge>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {readyCount} 就绪 · {processingCount} 处理中 · {failedCount} 失败
        </div>
        <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={onRefreshGraph} disabled={graphLoading}>
          {graphLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          刷新图谱
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r bg-white">
          {selectedBase.scope_type === 'channel' && (
            <div className="border-b p-4">
              <ChannelKnowledgeSummary overview={channelOverview} distilling={distilling} onDistill={onDistill} />
            </div>
          )}
          {canEditSources ? (
            <div className="border-b p-4">
              <UploadZone
                dragging={dragging}
                uploading={uploading}
                fileRef={fileRef}
                directoryRef={directoryRef}
                uploadNotice={uploadNotice}
                onDraggingChange={onDraggingChange}
                onUpload={onUpload}
              />
            </div>
          ) : (
            <div className="border-b p-4">
              <div className="rounded-md border border-[#dddddd] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-muted-foreground">
                {selectedBase.scope_type === 'platform' ? '平台知识库由平台侧维护。' : '组织知识库由组织侧维护。'}
                当前 App 可检索该知识库，但不能在这里上传或删除资料。
              </div>
            </div>
          )}
          <SourcesList
            sources={sources}
            loading={sourceLoading}
            deletingSourceId={deletingSourceId}
            selectedID={selection?.type === 'source' ? selection.source.id : null}
            onSelect={(source) => onSelect({ type: 'source', source })}
            onDelete={canEditSources ? onDeleteSource : undefined}
          />
        </aside>

        <main className="relative min-h-0 overflow-hidden bg-[#f8f8fa]">
          {graphLoading && (
            <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#e5e5e5] bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              加载图谱
            </div>
          )}
          <SigmaKnowledgeGraph
            sources={sources}
            graph={normalizedGraph}
            selection={selection}
            onSelect={onSelect}
          />
          <DetailPopover
            base={selectedBase}
            sources={sources}
            graph={normalizedGraph}
            selection={selection}
            readyCount={readyCount}
            failedCount={failedCount}
            deletingSourceId={deletingSourceId}
            onDelete={canEditSources ? onDeleteSource : undefined}
            onClose={() => onSelect(null)}
          />
        </main>
      </div>
    </div>
  )
}

function KnowledgeBaseGroup({
  title,
  icon: Icon,
  bases,
  selectedBaseId,
  onSelect,
  onDelete,
  deletingBaseId = '',
}: {
  title: string
  icon: LucideIcon
  bases: KnowledgeBase[]
  selectedBaseId: string
  onSelect: (id: string) => void
  onDelete?: (base: KnowledgeBase) => void
  deletingBaseId?: string
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="space-y-1">
        {bases.length === 0 ? (
          <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">暂无</div>
        ) : bases.map((base) => {
          const active = selectedBaseId === base.id
          const deleting = deletingBaseId === base.id
          const isDefaultAppBase = base.scope_type === 'app' && base.name === 'default'
          return (
            <div
              key={base.id}
              className={cn(
                'group flex items-start gap-2 rounded-md border px-3 py-2 transition-colors',
                active ? 'border-[#181d26] bg-[#f5f5f5]' : 'border-transparent hover:bg-[#fafafa]',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(base.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-[#1a1a1a]">{base.display_name}</span>
                  <ScopeBadge scope={base.scope_type} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{base.source_count} 资料 · {base.chunk_count} 分块</div>
              </button>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="mt-0.5 h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 focus:opacity-100 disabled:opacity-40"
                  disabled={isDefaultAppBase || deleting || Boolean(deletingBaseId)}
                  title={isDefaultAppBase ? '默认 App 知识库不能删除' : '删除知识库'}
                  onClick={() => onDelete(base)}
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExternalKnowledgeGroup({
  bases,
  selectedBaseId,
  subscribedBaseIds,
  loading,
  workingId,
  onSelect,
  onRefresh,
  onSubscribe,
  onUnsubscribe,
}: {
  bases: KnowledgeBase[]
  selectedBaseId: string
  subscribedBaseIds: Set<string>
  loading: boolean
  workingId: string
  onSelect: (base: KnowledgeBase) => void
  onRefresh: () => void
  onSubscribe: (base: KnowledgeBase) => void
  onUnsubscribe: (base: KnowledgeBase) => void
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5" />
	          组织授权知识库
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} title="刷新外部知识库">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>
      <div className="space-y-1">
        {loading && bases.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载外部知识库
          </div>
        ) : bases.length === 0 ? (
	          <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">组织尚未授权可订阅知识库</div>
        ) : bases.map((base) => {
          const subscribed = subscribedBaseIds.has(base.id)
          const available = base.is_active
          const active = selectedBaseId === base.id
          const working = workingId === base.id
          return (
            <div
              key={base.id}
              className={cn(
                'rounded-md border px-3 py-2 transition-colors',
                active ? 'border-[#181d26] bg-[#f5f5f5]' : 'border-transparent hover:bg-[#fafafa]',
              )}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  disabled={!subscribed}
                  onClick={() => subscribed && onSelect(base)}
                  className={cn(
                    'min-w-0 flex-1 text-left',
                    subscribed ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[#1a1a1a]">{base.display_name}</span>
                    <ScopeBadge scope={base.scope_type} />
                    {subscribed && <Badge variant="secondary" className="shrink-0 text-[10px]">已订阅</Badge>}
                    {!available && <Badge variant="outline" className="shrink-0 text-[10px]">已停用</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{base.source_count} 资料 · {base.chunk_count} 分块</div>
                </button>
                <Button
                  variant={subscribed ? 'outline' : 'default'}
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={working || (!available && !subscribed)}
                  onClick={() => subscribed ? onUnsubscribe(base) : onSubscribe(base)}
                >
                  {working ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : subscribed ? (
                    <>
                      <X className="h-3.5 w-3.5" />
                      取消
                    </>
                  ) : (
                    <>
                      {available ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {available ? '订阅' : '不可订阅'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChannelKnowledgePicker({
  channels,
  totalCount,
  loading,
  query,
  selectedChannelId,
  selectedBaseId,
  channelBases,
  onQueryChange,
  onRefresh,
  onSelect,
}: {
  channels: ChannelWithMeta[]
  totalCount: number
  loading: boolean
  query: string
  selectedChannelId: string
  selectedBaseId: string
  channelBases: KnowledgeBase[]
  onQueryChange: (value: string) => void
  onRefresh: () => void
  onSelect: (channel: ChannelWithMeta) => void
}) {
  const baseByChannel = useMemo(() => {
    const map = new Map<string, KnowledgeBase>()
    channelBases.forEach((base) => {
      if (base.channel_id) map.set(base.channel_id, base)
    })
    return map
  }, [channelBases])

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5" />
          频道知识库
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} title="刷新频道">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索频道" className="h-8 pl-8" />
      </div>
      <div className="space-y-1">
        {loading ? (
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载频道
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">{query.trim() ? '没有匹配频道' : '暂无频道'}</div>
        ) : channels.map((channel) => {
          const base = baseByChannel.get(channel.id)
          const active = selectedChannelId === channel.id || (base && selectedBaseId === base.id)
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelect(channel)}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left transition-colors',
                active ? 'border-[#181d26] bg-[#f5f5f5]' : 'border-transparent hover:bg-[#fafafa]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-[#1a1a1a]">{channel.name || '未命名频道'}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">频道</Badge>
              </div>
              <div className="mt-1 min-w-0 space-y-0.5 text-xs text-muted-foreground">
                <div className="truncate">
                  所有者 {channel.owner_name || channel.owner_email || '未知'}
                  {channel.owner_email && channel.owner_name ? ` · ${channel.owner_email}` : ''}
                </div>
                <div>
                  {base ? `${base.source_count} 资料 · ${base.chunk_count} 分块` : '选择后加载知识库'}
                </div>
              </div>
            </button>
          )
        })}
        {totalCount > channels.length && (
          <div className="px-1 py-1 text-xs text-muted-foreground">仅显示前 {channels.length} 个频道，可搜索缩小范围</div>
        )}
      </div>
    </div>
  )
}

function ChannelKnowledgeSummary({
  overview,
  distilling,
  onDistill,
}: {
  overview: ChannelKnowledgeOverview | null
  distilling: boolean
  onDistill: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[#1a1a1a]">频道知识沉淀</div>
        <div className="mt-1 text-xs text-muted-foreground">
          已沉淀到消息 {overview?.progress?.last_message_id ?? overview?.settings?.last_distilled_message_id ?? 0}
          {overview?.progress?.consecutive_failures ? ` · 连续失败 ${overview.progress.consecutive_failures}` : ''}
        </div>
        {overview?.progress?.last_error && (
          <div className="mt-1 truncate text-xs text-destructive">{overview.progress.last_error}</div>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={onDistill} disabled={distilling}>
        {distilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
        立即沉淀
      </Button>
    </div>
  )
}

function UploadZone({
  dragging,
  uploading,
  fileRef,
  directoryRef,
  uploadNotice,
  onDraggingChange,
  onUpload,
}: {
  dragging: boolean
  uploading: boolean
  fileRef: RefObject<HTMLInputElement | null>
  directoryRef: RefObject<HTMLInputElement | null>
  uploadNotice: string
  onDraggingChange: (value: boolean) => void
  onUpload: (files: FileList | File[]) => void
}) {
  useEffect(() => {
    const input = directoryRef.current
    if (!input) return
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  }, [directoryRef])

  return (
    <div
      className={cn(
        'flex min-h-[132px] flex-col items-center justify-center rounded-lg border border-dashed bg-white px-4 text-center transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-border',
      )}
      onDragEnter={(event) => { event.preventDefault(); onDraggingChange(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={(event) => {
        event.preventDefault()
        onDraggingChange(false)
        onUpload(event.dataTransfer.files)
      }}
    >
      <input ref={fileRef} type="file" multiple accept={SUPPORTED_KNOWLEDGE_UPLOAD_ACCEPT} className="hidden" onChange={(event) => event.target.files && onUpload(event.target.files)} />
      <input ref={directoryRef} type="file" multiple className="hidden" onChange={(event) => event.target.files && onUpload(event.target.files)} />
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4" />
          上传文件
        </Button>
        <Button variant="outline" onClick={() => directoryRef.current?.click()} disabled={uploading}>
          <FolderOpen className="h-4 w-4" />
          选择目录上传
        </Button>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        {uploading ? '正在上传并加入处理队列' : '或拖拽文件到这里'}
      </div>
      {uploadNotice && (
        <div className="mt-2 text-xs text-muted-foreground">
          {uploadNotice}
        </div>
      )}
    </div>
  )
}

function SourcesList({
  sources,
  loading,
  deletingSourceId,
  selectedID,
  onSelect,
  onDelete,
}: {
  sources: KnowledgeSource[]
  loading: boolean
  deletingSourceId?: number | null
  selectedID?: number | null
  onSelect?: (source: KnowledgeSource) => void
  onDelete?: (source: KnowledgeSource) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-white">
      <div className="shrink-0 border-b border-border px-4 py-3 text-sm font-medium text-[#1a1a1a]">知识来源</div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中
        </div>
      ) : sources.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">暂无资料</div>
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {sources.map((source) => (
            (() => {
              const deleting = deletingSourceId === source.id
              return (
            <button
              key={source.id}
              type="button"
              disabled={deleting}
              onClick={() => onSelect?.(source)}
              className={cn(
                'group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fafafa]',
                selectedID === source.id && 'bg-slate-50 shadow-[inset_3px_0_0_#181d26]',
                deleting && 'cursor-wait opacity-60',
              )}
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#667085]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[#1a1a1a]">{source.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <SourceStatusBadge source={source} />
                  <span className="text-xs text-muted-foreground">{source.chunk_count} 分块</span>
                  {source.file_size > 0 && <span className="text-xs text-muted-foreground">{formatBytes(source.file_size)}</span>}
                  {source.origin_type && <span className="text-xs text-muted-foreground">{source.origin_type}</span>}
                </div>
                {(source.processing_message || source.processing_stage) && source.status !== 'ready' && (
                  <div className="mt-2 max-w-xl">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{source.processing_message || source.processing_stage}</span>
                      <span>{source.processing_progress ?? 0}%</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-muted">
                      <div className="h-1 rounded-full bg-[#181d26]" style={{ width: `${Math.max(0, Math.min(100, source.processing_progress ?? 0))}%` }} />
                    </div>
                  </div>
                )}
              </div>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(source)
                  }}
                  disabled={deleting}
                  title="删除资料"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                </Button>
              )}
            </button>
              )
            })()
          ))}
        </div>
      )}
    </div>
  )
}

export function SigmaKnowledgeGraph({
  sources,
  graph,
  selection,
  onSelect,
}: {
  sources: KnowledgeSource[]
  graph: KnowledgeGraphData
  selection: Selection
  onSelect: (selection: Selection) => void
}) {
  const graphSourceSignature = useMemo(() => getGraphSourceSignature(sources), [sources])
  const graphSources = useMemo(() => sources.map((source) => ({
    ...source,
    processing_stage: '',
    processing_progress: 0,
    processing_message: '',
  })), [graphSourceSignature])
  const hasGraphData = graph.entities.length > 0
    || graph.relations.length > 0
    || (graph.entity_sources?.length || 0) > 0
  const graphSignature = useMemo(() => JSON.stringify(graph), [graph])
  const sigmaData = useMemo(() => (
    hasGraphData ? toSigmaData(graphSources, graph) : { nodes: [], edges: [] }
  ), [graphSources, graphSignature, hasGraphData])
  const handleNodeClick = useCallback((nodeId: string) => {
    if (nodeId.startsWith('s_')) {
      const source = sources.find((item) => `s_${item.id}` === nodeId)
      if (source) onSelect({ type: 'source', source })
      return
    }
    if (nodeId.startsWith('e_')) {
      const entity = graph.entities.find((item) => `e_${item.id}` === nodeId)
      if (entity) onSelect({ type: 'entity', entity })
    }
  }, [graph.entities, onSelect, sources])
  const {
    containerRef,
    setGraph,
    zoomIn,
    zoomOut,
    resetZoom,
    focusNode,
    isLayoutRunning,
    startLayout,
    stopLayout,
    setSelectedNode,
    edgesHidden,
    setEdgesHidden,
  } = useKnowledgeGraphSigma({
    onNodeClick: handleNodeClick,
    onStageClick: () => onSelect(null),
    focusViewportPaddingRight: 352,
  })
  const showGraph = hasGraphData && sigmaData.nodes.length > 0

  useEffect(() => {
    if (!showGraph) {
      setGraph(new Graph())
      setEdgesHidden(false)
      return
    }
    setGraph(buildSigmaGraph(sigmaData))
    setEdgesHidden(sigmaData.edges.length > 500)
  }, [setEdgesHidden, setGraph, showGraph, sigmaData])

  useEffect(() => {
    if (!showGraph) {
      setSelectedNode(null)
      return
    }
    if (selection?.type === 'source') {
      focusNode(`s_${selection.source.id}`)
    } else if (selection?.type === 'entity') {
      focusNode(`e_${selection.entity.id}`)
    } else {
      setSelectedNode(null)
    }
  }, [focusNode, selection, setSelectedNode, showGraph])

  const entityTypes = useMemo(() => {
    const types = new Set<string>()
    graph.entities.forEach((entity) => {
      if (entity.entity_type) types.add(entity.entity_type)
    })
    return Array.from(types).sort()
  }, [graph.entities])
  const readyCount = sources.filter((source) => source.status === 'ready').length
  const totalChunks = sources.reduce((sum, source) => sum + (source.chunk_count || 0), 0)

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 cursor-grab bg-[#f8f8fa] active:cursor-grabbing" />
      {!showGraph && (
        <GraphEmptyState readyCount={readyCount} sourceCount={sources.length} totalChunks={totalChunks} />
      )}
      {showGraph && (
        <>
          <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
            <GraphButton title="放大" onClick={zoomIn}><ZoomIn className="h-3.5 w-3.5" /></GraphButton>
            <GraphButton title="缩小" onClick={zoomOut}><ZoomOut className="h-3.5 w-3.5" /></GraphButton>
            <GraphButton title="适配屏幕" onClick={resetZoom}><Maximize2 className="h-3.5 w-3.5" /></GraphButton>
            <div className="my-0.5 h-px bg-[#e5e5e5]" />
            <GraphButton
              title={edgesHidden ? '显示连线' : '隐藏连线'}
              active={edgesHidden}
              onClick={() => setEdgesHidden(!edgesHidden)}
            >
              {edgesHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </GraphButton>
            <div className="my-0.5 h-px bg-[#e5e5e5]" />
            <GraphButton
              title={isLayoutRunning ? '停止布局' : '重新布局'}
              active={isLayoutRunning}
              onClick={isLayoutRunning ? stopLayout : startLayout}
            >
              {isLayoutRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </GraphButton>
          </div>
          {isLayoutRunning && (
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#3BA55D]/30 bg-[#3BA55D]/10 px-3 py-1 backdrop-blur-sm">
              <div className="h-1.5 w-1.5 animate-ping rounded-full bg-[#3BA55D]" />
              <span className="text-[11px] font-medium text-[#3BA55D]">布局优化中...</span>
            </div>
          )}
          <GraphLegend entityTypes={entityTypes} />
          <GraphStats sources={sources} graph={graph} />
        </>
      )}
    </>
  )
}

function GraphButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md border backdrop-blur-sm transition-colors',
        active
          ? 'border-[#3BA55D]/40 bg-[#3BA55D]/10 text-[#3BA55D]'
          : 'border-[#e5e5e5] bg-white/90 text-[#999] hover:bg-[#f5f5f5] hover:text-[#555]',
      )}
      title={title}
    >
      {children}
    </button>
  )
}

function GraphEmptyState({
  readyCount,
  sourceCount,
  totalChunks,
}: {
  readyCount: number
  sourceCount: number
  totalChunks: number
}) {
  const hasReadySources = readyCount > 0
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
      <div className="max-w-sm rounded-md border border-[#e5e5e5] bg-white/90 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
        <div className="text-sm font-medium text-[#333840]">
          {hasReadySources ? '暂无知识图谱' : '等待资料处理'}
        </div>
        <div className="mt-1 text-xs leading-5 text-[#777169]">
          {hasReadySources
            ? '资料已处理完成，可用于搜索；当前知识库尚未生成实体和关系。'
            : '上传并处理文件后图谱将自动生成。'}
        </div>
        {sourceCount > 0 && (
          <div className="mt-2 text-[11px] text-[#999]">
            资料 {sourceCount} · 分块 {totalChunks}
          </div>
        )}
      </div>
    </div>
  )
}

function GraphLegend({ entityTypes }: { entityTypes: string[] }) {
  return (
    <div className="absolute bottom-3 left-3 z-10 max-h-[50%] space-y-1 overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white/90 px-3 py-2 text-[11px] backdrop-blur-sm">
      <div className="mb-1 font-medium text-[#777169]">资料</div>
      <LegendRow color="#0891b2" label="文件上传" />
      <LegendRow color="#7c3aed" label="对话沉淀" />
      <LegendRow color="#d97706" label="回答回写" />
      {entityTypes.length > 0 && (
        <>
          <div className="mb-1 mt-2 font-medium text-[#777169]">实体</div>
          {entityTypes.map((entityType) => (
            <LegendRow key={entityType} color={getEntityColor(entityType)} label={entityType} />
          ))}
        </>
      )}
    </div>
  )
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="text-[#999]">{label}</span>
    </div>
  )
}

function GraphStats({ sources, graph }: { sources: KnowledgeSource[]; graph: KnowledgeGraphData }) {
  return (
    <div className="absolute bottom-3 left-[132px] z-10 rounded-lg border border-[#e5e5e5] bg-white/90 px-3 py-2 text-xs text-slate-600 backdrop-blur-sm">
      资料 {sources.length} · 实体 {graph.entities.length} · 关系 {graph.relations.length}
    </div>
  )
}

function DetailPopover({
  base,
  sources,
  graph,
  selection,
  readyCount,
  failedCount,
  deletingSourceId,
  onDelete,
  onClose,
}: {
  base: KnowledgeBase
  sources: KnowledgeSource[]
  graph: KnowledgeGraphData
  selection: Selection
  readyCount: number
  failedCount: number
  deletingSourceId?: number | null
  onDelete?: (source: KnowledgeSource) => void
  onClose: () => void
}) {
  if (!selection) return null
  return (
    <aside className="absolute right-4 top-4 z-20 max-h-[calc(100%-2rem)] w-[320px] overflow-auto rounded-lg border bg-white/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {selection.type === 'source' ? <FileText className="h-4 w-4" /> : <GitFork className="h-4 w-4" />}
          <span className="truncate text-sm font-medium">{selection.type === 'source' ? selection.source.title : selection.entity.name}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <DetailPanel
        base={base}
        sources={sources}
        graph={graph}
        selection={selection}
        readyCount={readyCount}
        failedCount={failedCount}
        deletingSourceId={deletingSourceId}
        onDelete={onDelete}
      />
    </aside>
  )
}

function DetailPanel({
  base,
  sources,
  graph,
  selection,
  readyCount,
  failedCount,
  deletingSourceId,
  onDelete,
}: {
  base: KnowledgeBase
  sources: KnowledgeSource[]
  graph: KnowledgeGraphData
  selection: Selection
  readyCount: number
  failedCount: number
  deletingSourceId?: number | null
  onDelete?: (source: KnowledgeSource) => void
}) {
  if (selection?.type === 'source') {
    const source = selection.source
    const sourceEntityIDs = new Set((graph.entity_sources || [])
      .filter((link) => String(link.source_id) === String(source.id))
      .map((link) => Number(link.entity_id)))
    const sourceEntities = graph.entities.filter((entity) => sourceEntityIDs.has(Number(entity.id)))
    const sourceEntityIDSet = new Set(sourceEntities.map((entity) => Number(entity.id)))
    const sourceRelations = graph.relations.filter((relation) => (
      sourceEntityIDSet.has(Number(relation.source_entity_id)) || sourceEntityIDSet.has(Number(relation.target_entity_id))
    ))
    return (
      <div className="space-y-3 p-4 text-sm">
        <SourceStatusBadge source={source} />
        {(source.status === 'pending' || source.status === 'processing') && <SourceStage source={source} />}
        <InfoRow label="分块" value={`${source.chunk_count}`} />
        <InfoRow label="类型" value={source.source_type} />
        <InfoRow label="大小" value={formatBytes(source.file_size)} />
        {source.file_key && (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">TOS 路径</div>
            <div className="break-all rounded-md bg-slate-50 p-2 font-mono text-xs text-slate-700">{source.file_key}</div>
          </div>
        )}
        {source.summary && (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">摘要</div>
            <div className="rounded-md bg-slate-50 p-2 text-xs leading-relaxed text-slate-700">{source.summary}</div>
          </div>
        )}
        {source.tags && source.tags.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">标签</div>
            <div className="flex flex-wrap gap-1">
              {source.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
            </div>
          </div>
        )}
        <InfoRow label="关联实体" value={`${sourceEntities.length}`} />
        <InfoRow label="相关关系" value={`${sourceRelations.length}`} />
        {sourceEntities.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">实体</div>
            <div className="flex flex-wrap gap-1">
              {sourceEntities.slice(0, 24).map((entity) => (
                <Badge key={entity.id} variant="outline">{entity.name}</Badge>
              ))}
              {sourceEntities.length > 24 && <Badge variant="secondary">+{sourceEntities.length - 24}</Badge>}
            </div>
          </div>
        )}
        {source.error_message && <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{source.error_message}</div>}
        {onDelete && (
          <Button
            variant="outline"
            className="w-full"
            disabled={deletingSourceId === source.id}
            onClick={() => onDelete(source)}
          >
            {deletingSourceId === source.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {deletingSourceId === source.id ? '删除中' : '删除资料'}
          </Button>
        )}
      </div>
    )
  }
  if (selection?.type === 'entity') {
    const entity = selection.entity
    const related = graph.relations.filter((relation) => relation.source_entity_id === entity.id || relation.target_entity_id === entity.id)
    const entityMap = new Map(graph.entities.map((item) => [item.id, item]))
    return (
      <div className="space-y-4 p-4 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{entity.entity_type || '实体'}</Badge>
          <InfoRow label="提及" value={`${entity.mention_count ?? 0}`} />
        </div>
        {entity.description && <p className="leading-relaxed text-slate-700">{entity.description}</p>}
        {entity.aliases && entity.aliases.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entity.aliases.map((alias) => <Badge key={alias} variant="secondary">{alias}</Badge>)}
          </div>
        )}
        <div>
          <div className="mb-2 text-xs text-muted-foreground">相关关系</div>
          <div className="space-y-2">
            {related.map((relation) => {
              const otherID = relation.source_entity_id === entity.id ? relation.target_entity_id : relation.source_entity_id
              const other = entityMap.get(otherID)
              return (
                <div key={relation.id || `${relation.source_entity_id}-${relation.target_entity_id}-${relation.relation_type}`} className="rounded-md border p-2 text-xs">
                  <div className="font-medium">{relation.relation_type} · {other?.name || otherID}</div>
                  {relation.description && <div className="mt-1 text-muted-foreground">{relation.description}</div>}
                </div>
              )
            })}
            {related.length === 0 && <div className="text-xs text-muted-foreground">暂无关系</div>}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2 p-4 text-sm">
      <p className="leading-relaxed text-muted-foreground">{base.description || 'App 知识库'}</p>
      <InfoRow label="资料源" value={`${sources.length}`} />
      <InfoRow label="已就绪" value={`${readyCount}`} />
      <InfoRow label="失败" value={`${failedCount}`} />
      <InfoRow label="实体" value={`${graph.entities.length}`} />
      <InfoRow label="关系" value={`${graph.relations.length}`} />
    </div>
  )
}

function SourceStage({ source }: { source: KnowledgeSource }) {
  const progress = Math.max(0, Math.min(100, source.processing_progress ?? (source.status === 'ready' ? 100 : 0)))
  return (
    <div className="space-y-2 rounded-md border bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-slate-700">{source.processing_message || source.processing_stage || '等待处理'}</span>
        <span className="shrink-0 text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  )
}

function toSigmaData(sources: KnowledgeSource[], graph: KnowledgeGraphData): SigmaData {
  const nodes: SigmaNode[] = []
  const edges: SigmaEdge[] = []
  const sourceIDs = new Set(sources.map((source) => Number(source.id)))
  const linkedEntityIDs = new Set((graph.entity_sources || [])
    .filter((link) => sourceIDs.has(Number(link.source_id)))
    .map((link) => Number(link.entity_id)))
  const hasSourceLinks = linkedEntityIDs.size > 0
  const visibleEntities = hasSourceLinks
    ? graph.entities.filter((entity) => linkedEntityIDs.has(Number(entity.id)))
    : graph.entities
  const visibleEntityIDs = new Set(visibleEntities.map((entity) => Number(entity.id)))

  sources.forEach((source) => {
    nodes.push({
      id: `s_${source.id}`,
      title: source.title,
      node_type: 'source',
      source_type: source.source_type || 'file_upload',
      chunk_count: source.chunk_count,
    })
  })
  visibleEntities.forEach((entity) => {
    nodes.push({
      id: `e_${entity.id}`,
      title: entity.name,
      node_type: 'entity',
      entity_type: entity.entity_type,
      mention_count: entity.mention_count,
    })
  })
  graph.relations.forEach((relation) => {
    if (!visibleEntityIDs.has(Number(relation.source_entity_id)) || !visibleEntityIDs.has(Number(relation.target_entity_id))) return
    edges.push({
      source: `e_${relation.source_entity_id}`,
      target: `e_${relation.target_entity_id}`,
      type: relation.relation_type || 'relation',
      weight: relation.weight || 1,
    })
  })
  graph.entity_sources?.forEach((link) => {
    if (!sourceIDs.has(Number(link.source_id)) || !visibleEntityIDs.has(Number(link.entity_id))) return
    edges.push({
      source: `e_${link.entity_id}`,
      target: `s_${link.source_id}`,
      type: 'mentioned_in',
      weight: 1,
    })
  })
  return { nodes, edges }
}

function buildSigmaGraph(data: SigmaData): Graph {
  const graph = new Graph({ multi: true })
  const sourceNodes = data.nodes.filter((node) => node.node_type === 'source')
  const entityNodes = data.nodes.filter((node) => node.node_type === 'entity')
  const entitySources = new Map<string, string[]>()

  for (const edge of data.edges) {
    if (edge.type === 'mentioned_in') {
      if (!entitySources.has(edge.source)) entitySources.set(edge.source, [])
      entitySources.get(edge.source)?.push(edge.target)
    }
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const spread = Math.sqrt(data.nodes.length) * 12
  const nodePositions = new Map<string, { x: number; y: number }>()

  sourceNodes.forEach((node, index) => {
    const angle = index * goldenAngle
    const radius = spread * Math.sqrt((index + 1) / Math.max(sourceNodes.length, 1))
    const x = radius * Math.cos(angle) + (Math.random() - 0.5) * spread * 0.1
    const y = radius * Math.sin(angle) + (Math.random() - 0.5) * spread * 0.1
    nodePositions.set(node.id, { x, y })
    graph.addNode(node.id, {
      label: node.title,
      size: Math.max(4, Math.min(14, 4 + (node.chunk_count || 0) * 0.8)),
      color: SOURCE_COLORS[node.source_type || ''] || '#6366f1',
      x,
      y,
      mass: 2 + (node.chunk_count || 0) * 0.5,
      nodeType: node.node_type,
      entityType: node.entity_type,
      sourceType: node.source_type,
    })
  })

  const childJitter = Math.sqrt(data.nodes.length) * 2
  entityNodes.forEach((node) => {
    const relatedSources = entitySources.get(node.id) || []
    let x = (Math.random() - 0.5) * spread * 0.2
    let y = (Math.random() - 0.5) * spread * 0.2
    if (relatedSources.length > 0) {
      let sx = 0
      let sy = 0
      let count = 0
      for (const sourceID of relatedSources) {
        const position = nodePositions.get(sourceID)
        if (position) {
          sx += position.x
          sy += position.y
          count += 1
        }
      }
      if (count > 0) {
        x = sx / count + (Math.random() - 0.5) * childJitter
        y = sy / count + (Math.random() - 0.5) * childJitter
      }
    }
    nodePositions.set(node.id, { x, y })
    graph.addNode(node.id, {
      label: node.title,
      size: Math.max(3, Math.min(10, 3 + (node.mention_count || 1))),
      color: getEntityColor(node.entity_type || ''),
      x,
      y,
      mass: 1,
      nodeType: node.node_type,
      entityType: node.entity_type,
      sourceType: node.source_type,
    })
  })

  const nodeIDs = new Set(data.nodes.map((node) => node.id))
  for (const edge of data.edges) {
    if (!nodeIDs.has(edge.source) || !nodeIDs.has(edge.target)) continue
    const isMentionedIn = edge.type === 'mentioned_in'
    const isRelation = !['shared_tags', 'supersedes', 'conversation', 'mentioned_in'].includes(edge.type)
    graph.addEdge(edge.source, edge.target, {
      weight: edge.weight,
      size: isMentionedIn ? 0.8 : isRelation ? 1.5 : Math.max(0.6, Math.min(2.5, edge.weight * 0.6)),
      color: isRelation ? getRelationColor(edge.type) : EDGE_COLORS[edge.type] || '#94a3b8',
      edgeType: edge.type,
      type: 'curved',
      curvature: 0.15 + Math.random() * 0.1,
    })
  }
  return graph
}

function ScopeBadge({ scope }: { scope: KnowledgeBase['scope_type'] }) {
  const label = scope === 'app' ? 'App' : scope === 'channel' ? '频道' : scope === 'organization' ? '组织' : '平台'
  return <Badge variant={scope === 'channel' ? 'secondary' : 'outline'} className="shrink-0 text-[10px]">{label}</Badge>
}

function getKnowledgeBaseScopeLabel(scope: KnowledgeBase['scope_type']) {
  if (scope === 'platform') return '平台知识库'
  if (scope === 'organization') return '组织知识库'
  if (scope === 'channel') return '频道知识库'
  return 'App 知识库'
}

function SourceStatusBadge({ source }: { source: KnowledgeSource }) {
  const status = source.status
  if (status === 'ready') return <Badge variant="success" className="text-[10px]">就绪</Badge>
  if (status === 'failed' || status === 'error') return <Badge variant="destructive" className="text-[10px]">失败</Badge>
  if (status === 'processing') return <Badge variant="secondary" className="text-[10px]">处理中</Badge>
  return <Badge variant="warning" className="text-[10px]">待处理</Badge>
}
