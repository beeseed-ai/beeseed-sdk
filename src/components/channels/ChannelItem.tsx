import type { ChannelWithMeta } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { Avatar, AvatarFallback } from '../ui/avatar.js'

interface Props {
  channel: ChannelWithMeta
  active: boolean
  onClick: () => void
}

export function ChannelItem({ channel, active, onClick }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        active ? 'bg-muted' : 'hover:bg-muted/50',
      )}
      onClick={onClick}
    >
      <Avatar className="size-9">
        <AvatarFallback className="text-sm">
          {(channel.name || '?')[0]}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{channel.name || '未命名'}</span>
          {channel.unread_count > 0 && (
            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
              {channel.unread_count}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {channel.last_message || `${channel.member_count} 位成员`}
        </p>
      </div>
    </button>
  )
}
