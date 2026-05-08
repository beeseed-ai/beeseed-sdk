import { useState } from 'react'
import { Plus, LogOut, ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useRooms } from '../../hooks/use-rooms.js'
import { useConnection } from '../../hooks/use-connection.js'
import type { RoomWithMeta } from '../../core/types.js'
import { RoomList } from '../rooms/RoomList.js'
import { RoomHeader } from '../rooms/RoomHeader.js'
import { CreateRoomDialog } from '../rooms/CreateRoomDialog.js'
import { ChatRoom } from '../chat/ChatRoom.js'
import { Button } from '../ui/button.js'

interface Props {
  className?: string
}

export function ChatLayout({ className }: Props) {
  const { user, signOut } = useAuth()
  const { rooms, currentRoomId, joinRoom } = useRooms()
  const { state: connState } = useConnection()
  const [showCreateRoom, setShowCreateRoom] = useState(false)

  const currentRoom = rooms.find((r) => r.id === currentRoomId)

  function handleSelectRoom(room: RoomWithMeta) {
    joinRoom(room.id)
  }

  function handleBack() {
    joinRoom(null as unknown as string)
  }

  const sidebarHeader = (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <h2 className="text-sm font-bold">对话</h2>
      <Button variant="ghost" size="icon-sm" onClick={() => setShowCreateRoom(true)}>
        <Plus className="size-4" />
      </Button>
    </div>
  )

  const sidebarFooter = (
    <div className="flex items-center justify-between border-t px-4 py-2">
      <span className="text-xs text-muted-foreground truncate">{user?.name}</span>
      <Button variant="ghost" size="icon-sm" onClick={signOut}>
        <LogOut className="size-3.5" />
      </Button>
    </div>
  )

  return (
    <div className={cn('flex h-screen bg-background', className)}>
      {/* Sidebar — hidden on mobile when a room is selected */}
      <div
        className={cn(
          'flex w-full flex-col border-r sm:w-72 sm:flex',
          currentRoomId ? 'hidden sm:flex' : 'flex',
        )}
      >
        {connState === 'reconnecting' && (
          <div className="bg-warning/20 px-4 py-1 text-center text-xs text-warning-foreground">
            重新连接中...
          </div>
        )}
        <RoomList
          rooms={rooms}
          currentRoomId={currentRoomId}
          onSelectRoom={handleSelectRoom}
          header={sidebarHeader}
          className="flex-1"
        />
        {sidebarFooter}
      </div>

      {/* Chat area — hidden on mobile when no room selected */}
      <div
        className={cn(
          'flex-1 flex-col',
          currentRoomId ? 'flex' : 'hidden sm:flex',
        )}
      >
        {currentRoom ? (
          <ChatRoom
            roomId={currentRoom.id}
            header={
              <RoomHeader
                room={currentRoom}
                leading={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="sm:hidden"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                }
              />
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-muted-foreground">选择一个对话开始聊天</span>
          </div>
        )}
      </div>

      <CreateRoomDialog open={showCreateRoom} onOpenChange={setShowCreateRoom} />
    </div>
  )
}
