import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { ChannelWithMeta } from '../../core/types.js'
import { cn } from '../../lib/cn.js'

interface Props {
  channel: ChannelWithMeta | null
  className?: string
  center?: React.ReactNode
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

export function ChannelHeader({ channel, className, center, leading, trailing }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => setCopied(false), [channel?.id])

  const copyChannelID = async () => {
    if (!channel?.id) return
    try {
      await navigator.clipboard.writeText(channel.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={cn('relative flex items-center gap-3 border-b border-border bg-white px-4 py-2.5', className)}>
      {leading}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <h3 className="text-sm font-semibold truncate">{channel?.name || '对话'}</h3>
        {channel && (
          <>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-white text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="复制频道 ID"
              title={copied ? '频道 ID 已复制' : '复制频道 ID'}
              data-beeseed-channel-id={channel.id}
              onClick={() => { void copyChannelID() }}
            >
              {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
            </button>
            <span className="text-xs text-muted-foreground shrink-0">{channel.member_count}位成员</span>
          </>
        )}
      </div>
      {center && (
        <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 lg:block">
          {center}
        </div>
      )}
      {trailing}
    </div>
  )
}
