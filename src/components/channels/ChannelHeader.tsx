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
  return (
    <div className={cn('relative flex items-center gap-3 border-b border-border bg-white px-4 py-2.5', className)}>
      {leading}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <h3 className="text-sm font-semibold truncate">{channel?.name || '对话'}</h3>
        {channel && (
          <span className="text-xs text-muted-foreground shrink-0">{channel.member_count}位成员</span>
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
