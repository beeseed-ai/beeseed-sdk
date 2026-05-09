import { Settings } from 'lucide-react'
import type { RoomWithMeta } from '../../core/types.js'
import { cn } from '../../lib/cn.js'

interface Props {
  room: RoomWithMeta | null
  className?: string
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

export function RoomHeader({ room, className, leading, trailing }: Props) {
  return (
    <div className={cn('flex items-center gap-3 border-b border-border px-4 py-2.5 bg-background', className)}>
      {leading}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Settings className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        <span className="text-xs text-muted-foreground">/</span>
        <h3 className="text-sm font-semibold truncate">{room?.name || '对话'}</h3>
        {room && (
          <span className="text-xs text-muted-foreground shrink-0">{room.member_count}位成员</span>
        )}
      </div>
      {trailing}
    </div>
  )
}
