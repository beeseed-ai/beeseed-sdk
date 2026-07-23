import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { ChannelWithMeta, KnowledgeSource } from '../../core/types.js'
import { useChannels } from '../../hooks/use-channels.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import {
  SigmaKnowledgeGraph,
  SourcesList,
  type ChannelKnowledgeGraphData,
  type KnowledgeGraphSelection,
} from '../admin/KnowledgeManageTab.js'

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
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [graph, setGraph] = useState<ChannelKnowledgeGraphData>(emptyGraph)
  const [selection, setSelection] = useState<KnowledgeGraphSelection>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    try {
      const graphPayload = await api.get(`channels/${currentChannelId}/knowledge/graph`, { signal }).json<unknown>()
      const normalizedGraph = normalizeGraph(graphPayload)
      setSources(normalizedGraph.sources ?? [])
      setGraph(normalizedGraph)
    } catch (requestError) {
      if ((requestError as { name?: string })?.name === 'AbortError') return
      console.error('[KnowledgePanel] load channel knowledge failed', requestError)
      setSources([])
      setGraph(emptyGraph())
      setError('当前频道知识库加载失败，请稍后重试。')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (!selectedChannelId) {
      setSources([])
      setGraph(emptyGraph())
      setLoading(false)
      return
    }
    const controller = new AbortController()
    void loadChannelKnowledge(selectedChannelId, controller.signal)
    return () => controller.abort()
  }, [loadChannelKnowledge, selectedChannelId])

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
              <p className="mt-1 text-sm text-muted-foreground">按频道查看知识来源和知识图谱。</p>
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
            <section className="flex min-h-[620px] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-5 sm:py-4">
                <h2 className="text-sm font-medium text-[#181d26]">频道知识</h2>
                <span className="text-xs text-muted-foreground">{selectedChannel?.name || '当前频道'} · {visibleSourceCount} 个来源</span>
              </div>

              <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[330px_minmax(0,1fr)]">
                <aside className="flex min-h-[280px] flex-col border-b border-border bg-white lg:min-h-0 lg:border-b-0 lg:border-r">
                  <SourcesList
                    sources={visibleSources}
                    loading={loading}
                    selectedID={selection?.type === 'source' ? selection.source.id : null}
                    className="rounded-none border-0"
                    header={(
                      <div className="flex flex-wrap gap-2" aria-label="知识来源类型">
                        {([
                          ['system', '系统沉淀'],
                          ['upload', '上传资料'],
                        ] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setSourceView(value)}
                            aria-pressed={sourceView === value}
                            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${sourceView === value ? 'border-[#181d26] bg-[#181d26] text-white' : 'border-border bg-white text-muted-foreground hover:bg-muted'}`}
                          >
                            {label} {sourceGroups[value].length}
                          </button>
                        ))}
                      </div>
                    )}
                    onSelect={(source) => setSelection({ type: 'source', source })}
                    onDelete={(source) => void deleteSource(source.id)}
                  />
                </aside>
                <main className="relative min-h-[420px] overflow-hidden bg-[#f8f8fa]">
                  {loading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在加载图谱...
                    </div>
                  ) : (
                    <SigmaKnowledgeGraph sources={sources} graph={graph} selection={selection} onSelect={setSelection} />
                  )}
                </main>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
