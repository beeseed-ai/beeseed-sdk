import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, RotateCcw, Save } from 'lucide-react'
import type { Channel, ChannelWithMeta } from '../../core/types.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Input } from '../ui/input.js'

interface ChannelKnowledgePromptState {
  extraction_prompt?: string
  extraction_prompt_mode?: 'auto' | 'manual'
  extraction_prompt_version?: number
  extraction_prompt_updated_at?: string
  extraction_prompt_status?: 'ready' | 'fallback'
  extraction_prompt_error?: string
}

interface ChannelDetailResponse {
  channel: Channel
  channel_description?: string
}

function readKnowledgePromptState(settings?: string): ChannelKnowledgePromptState {
  if (!settings) return {}
  try {
    const parsed = JSON.parse(settings) as { knowledge?: ChannelKnowledgePromptState }
    return parsed.knowledge ?? {}
  } catch {
    return {}
  }
}

function formatUpdatedAt(value?: string) {
  if (!value) return '尚未生成'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function ChannelKnowledgePromptSettings() {
  const { api } = useBeeSeedContext()
  const [channels, setChannels] = useState<ChannelWithMeta[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [channel, setChannel] = useState<Channel | null>(null)
  const [channelDescription, setChannelDescription] = useState('')
  const [query, setQuery] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const detailRequestRef = useRef(0)

  const promptState = useMemo(() => readKnowledgePromptState(channel?.settings), [channel?.settings])
  const filteredChannels = useMemo(() => {
    const active = channels.filter((item) => !item.deleted_at)
    const normalized = query.trim().toLowerCase()
    const matched = normalized
      ? active.filter((item) => [item.name ?? '', item.owner_name ?? '', item.owner_email ?? ''].join(' ').toLowerCase().includes(normalized))
      : active
    const visible = matched.slice(0, 100)
    const selected = active.find((item) => item.id === selectedChannelId)
    if (selected && !visible.some((item) => item.id === selected.id)) {
      return [selected, ...visible.slice(0, 99)]
    }
    return visible
  }, [channels, query, selectedChannelId])

  const loadChannelDetail = useCallback(async (channelId: string) => {
    const requestID = ++detailRequestRef.current
    if (!channelId) {
      setChannel(null)
      setPrompt('')
      setChannelDescription('')
      setDetailLoading(false)
      return
    }
    setDetailLoading(true)
    setError('')
    try {
      const data = await api.get(`admin/channels/${encodeURIComponent(channelId)}`).json<ChannelDetailResponse>()
      if (requestID !== detailRequestRef.current) return
      setChannel(data.channel)
      setChannelDescription(data.channel_description ?? '')
      setPrompt(readKnowledgePromptState(data.channel.settings).extraction_prompt ?? '')
      setDirty(false)
    } catch (err) {
      if (requestID === detailRequestRef.current) {
        setError(err instanceof Error ? err.message : '频道提示词加载失败')
      }
    } finally {
      if (requestID === detailRequestRef.current) setDetailLoading(false)
    }
  }, [api])

  useEffect(() => {
    let active = true
    api.get('admin/channels').json<ChannelWithMeta[]>()
      .then((items) => {
        if (!active) return
        const next = (items ?? []).filter((item) => !item.deleted_at)
        setChannels(next)
        setSelectedChannelId((current) => current || next[0]?.id || '')
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '频道列表加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [api])

  useEffect(() => {
    void loadChannelDetail(selectedChannelId)
  }, [loadChannelDetail, selectedChannelId])

  async function savePrompt() {
    if (!channel || !dirty || !prompt.trim()) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.patch(`admin/channels/${encodeURIComponent(channel.id)}`, {
        json: { knowledge_extraction_prompt: prompt },
      })
      await loadChannelDetail(channel.id)
      setNotice('提示词已保存为手工模式')
    } catch (err) {
      setError(err instanceof Error ? err.message : '提示词保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function regeneratePrompt() {
    if (!channel) return
    setRegenerating(true)
    setError('')
    setNotice('')
    try {
      await api.patch(`admin/channels/${encodeURIComponent(channel.id)}`, {
        json: { regenerate_knowledge_extraction_prompt: true },
      })
      await loadChannelDetail(channel.id)
      setNotice('已根据当前频道名称和描述重新生成')
    } catch (err) {
      setError(err instanceof Error ? err.message : '提示词重新生成失败')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[#181d26]">知识抽取提示词</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            系统按频道名称和描述生成；手工编辑后不会被自动覆盖。
          </p>
        </div>
        {channel && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{promptState.extraction_prompt_mode === 'manual' ? '手工模式' : '自动模式'}</span>
            <span>版本 {promptState.extraction_prompt_version ?? 0}</span>
            <span>{promptState.extraction_prompt_status === 'fallback' ? '安全模板' : '生成完成'}</span>
          </div>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <label htmlFor="knowledge-prompt-channel-search" className="mb-1.5 block text-xs font-medium text-[#555]">搜索频道</label>
            <Input
              id="knowledge-prompt-channel-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="按频道名或创建人搜索"
            />
          </div>
          <div>
            <label htmlFor="knowledge-prompt-channel-select" className="mb-1.5 block text-xs font-medium text-[#555]">频道</label>
            <select
              id="knowledge-prompt-channel-select"
              value={selectedChannelId}
              onChange={(event) => setSelectedChannelId(event.target.value)}
              disabled={loading}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-[#1a1a1a] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20 disabled:opacity-50"
            >
              {filteredChannels.length === 0 && <option value="">暂无匹配频道</option>}
              {filteredChannels.map((item) => (
                <option key={item.id} value={item.id}>{item.name || '未命名频道'}</option>
              ))}
            </select>
          </div>
        </div>

        {channel ? (
          <>
            <div className="rounded-lg border border-border bg-[#fafafa] px-3 py-2 text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-[#555]">生成依据：</span>
              {channel.name || '未命名频道'} · {channelDescription || '未设置频道描述'}
            </div>
            <div>
              <label htmlFor="knowledge-extraction-prompt" className="mb-1.5 block text-xs font-medium text-[#555]">当前生效提示词</label>
              <textarea
                id="knowledge-extraction-prompt"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value)
                  setDirty(true)
                  setNotice('')
                }}
                rows={12}
                disabled={detailLoading}
                className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm leading-6 text-[#181d26] outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20 disabled:opacity-50"
              />
              <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>必须包含“重点抽取”和“忽略”，最多 8,000 字。</span>
                <span>更新于 {formatUpdatedAt(promptState.extraction_prompt_updated_at)}</span>
              </div>
            </div>
            {promptState.extraction_prompt_status === 'fallback' && promptState.extraction_prompt_error && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                自动生成服务暂不可用，当前使用安全模板：{promptState.extraction_prompt_error}
              </div>
            )}
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">{notice}</div>}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void regeneratePrompt()}
                disabled={regenerating || saving || detailLoading}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-medium text-[#181d26] disabled:pointer-events-none disabled:opacity-50"
              >
                {regenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {regenerating ? '生成中...' : '重新自动生成'}
              </button>
              <button
                type="button"
                onClick={() => void savePrompt()}
                disabled={!dirty || !prompt.trim() || saving || regenerating || detailLoading}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#181d26] px-3 text-sm font-medium text-white disabled:pointer-events-none disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : '保存提示词'}
              </button>
            </div>
          </>
        ) : (
          <>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {loading ? '正在加载频道...' : '请选择一个频道'}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
