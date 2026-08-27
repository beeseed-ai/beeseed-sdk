import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'
import type { ChannelWithMeta, ReasonixChannelRuntimePublication } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'

interface ReasonixPublicationResponse {
  publication?: ReasonixChannelRuntimePublication
}

interface Props {
  channelId: string
  agentIds: string[]
  channel?: ChannelWithMeta
  className?: string
}

export function ReasonixPublicationStatus({ channelId, agentIds, channel, className }: Props) {
  const { api } = useBeeSeedContext()
  const [publication, setPublication] = useState<ReasonixChannelRuntimePublication | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    setPublication(null)
    if (!channelId || agentIds.length === 0) return

    const load = async () => {
      const data = await api
        .get(`admin/reasonix/channels/${encodeURIComponent(channelId)}/runtime-publication`)
        .json<ReasonixPublicationResponse>()
        .catch(() => null)
      if (cancelled) return
      setPublication(data?.publication ?? null)
      if (data?.publication?.status === 'pending' || data?.publication?.status === 'publishing') {
        timer = setTimeout(() => void load(), 3000)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [agentIds.length, api, channelId])

  const resolved = useMemo<ReasonixChannelRuntimePublication | null>(() => {
    if (publication) return publication
    if (!channel?.publication_status) return null
    return {
      app_id: '',
      channel_id: channelId,
      status: channel.publication_status || 'pending',
      desired_revision: channel.desired_revision ?? 0,
      active_revision: channel.active_revision,
      effective_revision: channel.effective_revision,
      last_error_code: channel.publication_error_code,
      last_error_detail: channel.publication_error_detail,
    }
  }, [channel, channelId, publication])

  if (!resolved) return null

  const failed = resolved.status === 'failed'
  const active = resolved.status === 'active'
  const updatePending = Boolean(resolved.update_pending)
    || Boolean(resolved.active_revision && resolved.effective_revision && resolved.active_revision !== resolved.effective_revision)
  const label = failed
    ? (resolved.active_revision ? '最新配置发布失败，继续使用上一版' : '频道配置发布失败')
    : updatePending ? '更新待重启'
      : active ? 'ReasonIX 配置已生效' : '频道配置发布中'
  const detail = failed ? resolved.last_error_detail?.trim() : undefined

  return (
    <div
      role={failed ? 'alert' : 'status'}
      className={cn(
        'flex min-h-8 shrink-0 items-center gap-2 border-b border-[#dddddd] bg-white px-4 py-1.5 text-xs',
        failed ? 'text-[#aa2d00]' : active && !updatePending ? 'text-[#006400]' : 'text-[#6f4d00]',
        className,
      )}
      title={detail}
    >
      {failed ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : active && !updatePending ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <LoaderCircle className={cn('h-3.5 w-3.5 shrink-0', !updatePending && 'animate-spin')} aria-hidden />
      )}
      <span className="font-medium">{label}</span>
      {detail && <span className="truncate text-[#6f4d00]">{detail}</span>}
    </div>
  )
}
