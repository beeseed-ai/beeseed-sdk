import type { RoomWithMeta } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { ScrollArea } from '../ui/scroll-area.js'
import { RoomItem } from './RoomItem.js'

interface Props {
  rooms: RoomWithMeta[]
  currentRoomId: string | null
  onSelectRoom: (room: RoomWithMeta) => void
  header?: React.ReactNode
  className?: string
}

export function RoomList({ rooms, currentRoomId, onSelectRoom, header, className }: Props) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      {header}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {rooms.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              暂无对话
            </div>
          ) : (
            rooms.map((room) => (
              <RoomItem
                key={room.id}
                room={room}
                active={room.id === currentRoomId}
                onClick={() => onSelectRoom(room)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
