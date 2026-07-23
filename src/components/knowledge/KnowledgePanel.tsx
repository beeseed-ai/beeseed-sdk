import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, FileText, Loader2, Search, Trash2 } from 'lucide-react'
import type { ChannelWithMeta, KnowledgeSearchResult, KnowledgeSource } from '../../core/types.js'
import { useChannels } from '../../hooks/use-channels.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import {
  SigmaKnowledgeGraph,
  type ChannelKnowledgeGraphData,
  type KnowledgeGraphSelection,
} from '../admin/KnowledgeManageTab.js'
import { Badge } from '../ui/badge.js'
import { Input } from '../ui/input.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js'
import { formatBytes } from '../../lib/format.js'

type ChannelKnowledgeOverview = {
  settings?: { channel_knowledge_base_id?: string }
}

type KnowledgePanelProps = {
  channels?: ChannelWithMeta[]
  channelId?: string | null
  onChannelChange?: (channelId: string) => void
}

const emptyGraph = (): ChannelKnowledgeGraphData => ({ entities: [], relations: [], entity_sources: [] })

function arrayFromPayload<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as T[]
  }
  return []
}

function normalizeGraph(payload: unknown): ChannelKnowledgeGraphData {
  const graph = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  return {
    sources: arrayFromPayload<KnowledgeSource>(graph.sources, ['sources', 'items', 'data']),
    entities: arrayFromPayload(graph.entities, ['entities', 'items', 'data']),
    relations: arrayFromPayload(graph.relations, ['relations', 'items', 'data']),
    entity_sources: arrayFromPayload(graph.entity_sources, ['entity_sources', 'items', 'data']),
  }
}

export function KnowledgePanel({ channels, channelId, onChannelChange }: KnowledgePanelProps = {}) {
  const { api } = useBeeSeedContext()
  const channelState = useChannels()
  const availableChannels = channels ?? channelState.channels
  const selectedChannelId = channelId === undefined ? channelState.currentChannelId : channelId
  const changeChannel = onChannelChange ?? ((nextChannelId: string) => channelState.setCurrentChannel(nextChannelId))
  const [knowledgeBaseId, setKnowledgeBaseId] = useState('')
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [graph, setGraph] = useState<ChannelKnowledgeGraphData>(emptyGraph)
  const [selection, setSelection] = useState<KnowledgeGraphSelection>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [sourceView, setSourceView] = useState<'system' | 'upload'>('system')
  const sourceGroups = useMemo(() => ({
    system: sources.filter((source) => (source.review_status ?? 'published') === 'published' && source.source_type !== 'file_upload'),
    upload: sources.filter((source) => source.source_type === 'file_upload' && (source.review_status ?? 'published') === 'published'),
  }), [sources])
  const visibleSources = sourceGroups[sourceView]
  const visibleSourceCount = sourceGroups.system.length + sourceGroups.upload.length

  const loadChannelKnowledge = useCallback(async (currentChannelId: string, signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    setSelection(null)
    setSearchResults([])
    try {
      const overview = await api.get(`channels/${currentChannelId}/knowledge`, { signal }).json<ChannelKnowledgeOverview>()
      const kbId = overview.settings?.channel_knowledge_base_id || ''
      setKnowledgeBaseId(kbId)
      const [sourcesPayload, graphPayload] = await Promise.all([
        kbId
          ? api.get('knowledge/sources', { searchParams: { kb_id: kbId }, signal }).json<unknown>()
          : Promise.resolve([]),
        api.get(`channels/${currentChannelId}/knowledge/graph`, { signal }).json<unknown>(),
      ])
      setSources(arrayFromPayload<KnowledgeSource>(sourcesPayload, ['sources', 'items', 'data', 'results']))
      setGraph(normalizeGraph(graphPayload))
    } catch (requestError) {
      if ((requestError as { name?: string })?.name === 'AbortError') return
      console.error('[KnowledgePanel] load channel knowledge failed', requestError)
      setKnowledgeBaseId('')
      setSources([])
      setGraph(emptyGraph())
      setError('当前频道知识库加载失败，请稍后重试。')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (!selectedChannelId) {
      setKnowledgeBaseId('')
      setSources([])
      setGraph(emptyGraph())
      setLoading(false)
      return
    }
    const controller = new AbortController()
    void loadChannelKnowledge(selectedChannelId, controller.signal)
    return () => controller.abort()
  }, [loadChannelKnowledge, selectedChannelId])

  const handleSearch = async () => {
    const query = searchQuery.trim()
    if (!query || !knowledgeBaseId) return
    setSearching(true)
    setError('')
    try {
      const payload = await api.post('knowledge/search', {
        json: { query, kb_ids: [knowledgeBaseId] },
      }).json<unknown>()
      setSearchResults(arrayFromPayload<KnowledgeSearchResult>(payload, ['results', 'searchResults', 'items', 'data']))
    } catch (requestError) {
      console.error('[KnowledgePanel] search channel knowledge failed', requestError)
      setSearchResults([])
      setError('当前频道知识搜索失败，请稍后重试。')
    } finally {
      setSearching(false)
    }
  }

  const deleteSource = async (sourceId: number) => {
    if (!selectedChannelId || !window.confirm('确定删除这个知识来源吗？')) return
    await api.delete(`knowledge/${sourceId}`)
    await loadChannelKnowledge(selectedChannelId)
  }

  const selectedChannel = availableChannels.find((channel) => channel.id === selectedChannelId)

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-4 p-4 sm:space-y-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-medium text-[#181d26]">知识库</h1>
              <p className="mt-1 text-sm text-muted-foreground">按频道查看知识来源、搜索结果和知识图谱。</p>
            </div>
            <label className="min-w-56 text-xs font-medium text-[#41454d]">
              当前频道
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-[#181d26]"
                value={selectedChannelId || ''}
                onChange={(event) => event.target.value && changeChannel(event.target.value)}
              >
                <option value="">请选择频道</option>
                {availableChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>{channel.name || '未命名频道'}</option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
          {!selectedChannelId ? (
            <div className="rounded-xl border border-border bg-white p-12 text-center text-sm text-muted-foreground">
              请先选择一个可访问频道。
            </div>
          ) : (
            <Tabs defaultValue="sources" className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-5 sm:py-4">
                <TabsList>
                  <TabsTrigger value="sources">来源</TabsTrigger>
                  <TabsTrigger value="search">搜索</TabsTrigger>
                  <TabsTrigger value="graph">图谱</TabsTrigger>
                </TabsList>
                <span className="text-xs text-muted-foreground">{selectedChannel?.name || '当前频道'} · {visibleSourceCount} 个来源</span>
              </div>

              <TabsContent value="sources" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                <div className="mb-4 flex flex-wrap gap-2" aria-label="知识来源类型">
                  {([
                    ['system', '系统沉淀'],
                    ['upload', '上传资料'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSourceView(value)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${sourceView === value ? 'border-[#181d26] bg-[#181d26] text-white' : 'border-border bg-white text-muted-foreground hover:bg-muted'}`}
                    >
                      {label} {sourceGroups[value].length}
                    </button>
                  ))}
                </div>
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />加载中...</div>
                ) : visibleSources.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground"><BookOpen className="mx-auto mb-3 h-6 w-6" />当前分区暂无知识来源</div>
                ) : (
                  <div className="space-y-2">
                    {visibleSources.map((source) => (
                      <div key={source.id} className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#181d26]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{source.title}</div>
                          {source.summary && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{source.summary}</div>}
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant={source.status === 'ready' ? 'success' : source.status === 'error' || source.status === 'failed' ? 'destructive' : 'outline'} className="text-[10px]">
                              {source.status === 'ready' ? '就绪' : source.status === 'processing' ? '处理中' : source.status === 'error' || source.status === 'failed' ? '错误' : '等待中'}
                            </Badge>
                            {source.chunk_count > 0 && <span className="text-[10px] text-muted-foreground">{source.chunk_count} 分片</span>}
                            {source.file_size > 0 && <span className="text-[10px] text-muted-foreground">{formatBytes(source.file_size)}</span>}
                          </div>
                        </div>
                        <button type="button" onClick={() => void deleteSource(source.id)} className="hidden rounded p-1 hover:bg-destructive/10 group-hover:block" aria-label={`删除 ${source.title}`}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="search" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                <div className="mb-3 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder={`搜索“${selectedChannel?.name || '当前频道'}”知识库...`} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void handleSearch()} className="pl-8" />
                  </div>
                  <button type="button" className="rounded-md bg-[#181d26] px-4 text-sm font-medium text-white disabled:opacity-50" onClick={() => void handleSearch()} disabled={searching || !knowledgeBaseId}>搜索</button>
                </div>
                {searching ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />搜索中...</div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-3">{searchResults.map((result) => <div key={result.chunk_id} className="rounded-lg border border-border p-3"><div className="mb-1 flex items-center gap-2"><span className="text-xs font-medium">{result.source_title}</span><span className="text-[10px] text-muted-foreground">相似度 {(result.similarity * 100).toFixed(0)}%</span></div><div className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{result.content}</div></div>)}</div>
                ) : searchQuery ? <div className="py-8 text-center text-sm text-muted-foreground">当前频道未找到相关内容</div> : <div className="py-8 text-center text-sm text-muted-foreground">输入关键词搜索当前频道知识库</div>}
              </TabsContent>

              <TabsContent value="graph" className="relative min-h-[520px] flex-1 overflow-hidden p-0">
                {loading ? <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />正在加载图谱...</div> : <SigmaKnowledgeGraph sources={sources} graph={graph} selection={selection} onSelect={setSelection} />}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  )
}
