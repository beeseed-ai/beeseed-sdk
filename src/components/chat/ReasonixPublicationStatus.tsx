import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'

interface ReasonixPublication {
  publication_status: 'pending' | 'publishing' | 'active' | 'failed' | 'superseded' | string
  last_error_detail?: string
}

interface ReasonixPublicationResponse {
  publication?: ReasonixPublication
}

interface Props {
  channelId: string
  agentIds: string[]
  className?: string
}

export function ReasonixPublicationStatus({ channelId, agentIds, className }: Props) {
  const { api } = useBeeSeedContext()
  const [publication, setPublication] = useState<ReasonixPublication | null>(null)
  const agentId = agentIds.length === 1 ? agentIds[0] : undefined

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    setPublication(null)
    if (!channelId || !agentId) return

    const load = async () => {
      const data = await api
        .get(`admin/reasonix/channels/${encodeURIComponent(channelId)}/agents/${encodeURIComponent(agentId)}/publication`)
        .json<ReasonixPublicationResponse>()
        .catch(() => null)
      if (cancelled) return
      setPublication(data?.publication ?? null)
      if (data?.publication?.publication_status === 'pending' || data?.publication?.publication_status === 'publishing') {
        timer = setTimeout(() => void load(), 3000)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [agentId, api, channelId])

  if (!publication) return null

  const status = publication.publication_status
  const failed = status === 'failed'
  const active = status === 'active'
  const label = failed ? 'ReasonIX 发布失败' : active ? 'ReasonIX 已生效' : 'ReasonIX 发布中'
  const detail = failed ? publication.last_error_detail?.trim() : undefined

  return (
    <div
      role={failed ? 'alert' : 'status'}
      className={cn(
        'flex min-h-8 shrink-0 items-center gap-2 border-b border-[#dddddd] bg-white px-4 py-1.5 text-xs',
        failed ? 'text-[#aa2d00]' : active ? 'text-[#006400]' : 'text-[#6f4d00]',
        className,
      )}
      title={detail}
    >
      {failed ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : active ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      )}
      <span className="font-medium">{label}</span>
      {detail && <span className="truncate text-[#6f4d00]">{detail}</span>}
    </div>
  )
}
