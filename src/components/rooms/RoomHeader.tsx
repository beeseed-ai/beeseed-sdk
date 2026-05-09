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
    <div className={cn('flex items-center gap-3 border-b px-4 py-3', className)}>
      {leading}
      <div className="flex-1 overflow-hidden">
        <h3 className="text-sm font-medium truncate">{room?.name || '对话'}</h3>
        {room && <span className="text-xs text-muted-foreground">{room.member_count} 位成员</span>}
      </div>
      {trailing}
    </div>
  )
}
