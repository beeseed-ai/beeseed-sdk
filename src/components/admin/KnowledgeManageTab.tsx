import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Database, FileText, FolderOpen, Loader2, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import type { KnowledgeBase, KnowledgeSource } from '../../core/types.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { cn } from '../../lib/cn.js'
import { formatBytes } from '../../lib/format.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Badge } from '../ui/badge.js'

type KnowledgeBasesResponse = { bases: KnowledgeBase[] }
type ChannelKnowledgeOverview = {
  settings?: {
    enabled?: boolean
    auto_distill?: boolean
    last_distilled_message_id?: number
  }
  progress?: {
    last_message_id?: number
    consecutive_failures?: number
    last_error?: string
  }
}

export function KnowledgeManageTab() {
  const { api } = useBeeSeedContext()
  const fileRef = useRef<HTMLInputElement>(null)
  const [bases, setBases] = useState<KnowledgeBase[]>([])
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [selectedBaseId, setSelectedBaseId] = useState('')
  const [loading, setLoading] = useState(false)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [distilling, setDistilling] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [newName, setNewName] = useState('')
  const [channelOverview, setChannelOverview] = useState<ChannelKnowledgeOverview | null>(null)

  const appBases = useMemo(() => bases.filter((base) => base.scope_type === 'app'), [bases])
  const channelBases = useMemo(() => bases.filter((base) => base.scope_type === 'channel'), [bases])
  const selectedBase = bases.find((base) => base.id === selectedBaseId) ?? null

  const loadBases = async () => {
    setLoading(true)
    try {
      const data = await api.get('knowledge/bases').json<KnowledgeBasesResponse>()
      const nextBases = data.bases ?? []
      setBases(nextBases)
      setSelectedBaseId((current) => current || nextBases.find((base) => base.scope_type === 'app')?.id || nextBases[0]?.id || '')
    } finally {
      setLoading(false)
    }
  }

  const loadSources = async (knowledgeBaseId = selectedBaseId) => {
    if (!knowledgeBaseId) {
      setSources([])
      return
    }
    setSourceLoading(true)
    try {
      const data = await api.get('knowledge/sources', { searchParams: { kb_id: knowledgeBaseId } }).json<KnowledgeSource[] | { sources: KnowledgeSource[] }>()
      setSources(Array.isArray(data) ? data : data.sources ?? [])
    } finally {
      setSourceLoading(false)
    }
  }

  useEffect(() => { void loadBases() }, [])
  useEffect(() => { void loadSources(selectedBaseId) }, [selectedBaseId])
  useEffect(() => {
    if (selectedBase?.scope_type !== 'channel' || !selectedBase.channel_id) {
      setChannelOverview(null)
      return
    }
    let active = true
    api.get(`channels/${selectedBase.channel_id}/knowledge`).json<ChannelKnowledgeOverview>().then((data) => {
      if (active) setChannelOverview(data)
    }).catch(() => {
      if (active) setChannelOverview(null)
    })
    return () => { active = false }
  }, [api, selectedBase?.id, selectedBase?.scope_type, selectedBase?.channel_id])

  const createBase = async () => {
    const displayName = newName.trim()
    if (!displayName) return
    const base = await api.post('knowledge/bases', {
      json: { display_name: displayName, category: 'general' },
    }).json<KnowledgeBase>()
    setBases((items) => [base, ...items])
    setSelectedBaseId(base.id)
    setNewName('')
  }

  const uploadFiles = async (files: FileList | File[]) => {
    if (!selectedBase || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.set('file', file)
        form.set('knowledge_base_id', selectedBase.id)
        await api.post('knowledge/sources', { body: form }).json<KnowledgeSource>()
      }
      await Promise.all([loadBases(), loadSources(selectedBase.id)])
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const deleteSource = async (source: KnowledgeSource) => {
    await api.delete(`knowledge/sources/${source.id}`)
    setSources((items) => items.filter((item) => item.id !== source.id))
    void loadBases()
  }

  const distillChannel = async () => {
    if (selectedBase?.scope_type !== 'channel' || !selectedBase.channel_id) return
    setDistilling(true)
    try {
      await api.post(`channels/${selectedBase.channel_id}/knowledge/distill-now`, { json: { limit: 50 } }).json()
      await Promise.all([loadSources(selectedBase.id), loadBases()])
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
              onSelect={setSelectedBaseId}
            />
            <KnowledgeBaseGroup
              title="频道知识库"
              icon={BookOpen}
              bases={channelBases}
              selectedBaseId={selectedBaseId}
              onSelect={setSelectedBaseId}
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
                {selectedBase.source_count} 资料 · {selectedBase.chunk_count} 分块
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadSources()}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {selectedBase ? (
            <div className="space-y-4">
              {selectedBase.scope_type === 'channel' && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#1a1a1a]">频道知识沉淀</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      已沉淀到消息 {channelOverview?.progress?.last_message_id ?? channelOverview?.settings?.last_distilled_message_id ?? 0}
                      {channelOverview?.progress?.consecutive_failures ? ` · 连续失败 ${channelOverview.progress.consecutive_failures}` : ''}
                    </div>
                    {channelOverview?.progress?.last_error && (
                      <div className="mt-1 truncate text-xs text-destructive">{channelOverview.progress.last_error}</div>
                    )}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void distillChannel()} disabled={distilling}>
                    {distilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                    立即沉淀
                  </Button>
                </div>
              )}

              <div
                className={cn(
                  'flex min-h-[132px] flex-col items-center justify-center rounded-lg border border-dashed bg-white px-4 text-center transition-colors',
                  dragging ? 'border-primary bg-primary/5' : 'border-border',
                )}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  void uploadFiles(event.dataTransfer.files)
                }}
              >
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => event.target.files && void uploadFiles(event.target.files)} />
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Upload className="h-4 w-4" />
                    上传文件
                  </Button>
                  <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <FolderOpen className="h-4 w-4" />
                    选择多个文件
                  </Button>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  {uploading ? '正在上传并加入处理队列' : '或拖拽文件到这里'}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-white">
                <div className="border-b border-border px-4 py-3 text-sm font-medium text-[#1a1a1a]">知识来源</div>
                {sourceLoading ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    加载中
                  </div>
                ) : sources.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">暂无资料</div>
                ) : (
                  <div className="divide-y divide-border">
                    {sources.map((source) => (
                      <div key={source.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-[#fafafa]">
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
                        <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100" onClick={() => void deleteSource(source)} title="删除资料">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无可管理的知识库</div>
          )}
        </div>
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
}: {
  title: string
  icon: typeof Database
  bases: KnowledgeBase[]
  selectedBaseId: string
  onSelect: (id: string) => void
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
        ) : bases.map((base) => (
          <button
            key={base.id}
            type="button"
            onClick={() => onSelect(base.id)}
            className={cn(
              'w-full rounded-md border px-3 py-2 text-left transition-colors',
              selectedBaseId === base.id ? 'border-[#181d26] bg-[#f5f5f5]' : 'border-transparent hover:bg-[#fafafa]',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-[#1a1a1a]">{base.display_name}</span>
              <ScopeBadge scope={base.scope_type} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{base.source_count} 资料 · {base.chunk_count} 分块</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ScopeBadge({ scope }: { scope: KnowledgeBase['scope_type'] }) {
  const label = scope === 'app' ? 'App' : scope === 'channel' ? '频道' : scope === 'organization' ? '组织' : '平台'
  return <Badge variant={scope === 'channel' ? 'secondary' : 'outline'} className="shrink-0 text-[10px]">{label}</Badge>
}

function SourceStatusBadge({ source }: { source: KnowledgeSource }) {
  const status = source.status
  if (status === 'ready') return <Badge variant="success" className="text-[10px]">就绪</Badge>
  if (status === 'failed' || status === 'error') return <Badge variant="destructive" className="text-[10px]">失败</Badge>
  if (status === 'processing') return <Badge variant="secondary" className="text-[10px]">处理中</Badge>
  return <Badge variant="warning" className="text-[10px]">待处理</Badge>
}
