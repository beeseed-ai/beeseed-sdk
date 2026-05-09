import { useState } from 'react'
import { MessageSquare, ListTodo, BookOpen, FolderOpen, Bot, Clock, Bell, Plus } from 'lucide-react'
import type { FeatureView, RoomWithMeta } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useNotifications } from '../../hooks/use-notifications.js'
import { RoomList } from '../rooms/RoomList.js'
import { CreateRoomDialog } from '../rooms/CreateRoomDialog.js'
import { Button } from '../ui/button.js'

interface NavItem {
  id: FeatureView
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: '消息', icon: MessageSquare },
  { id: 'tasks', label: '任务', icon: ListTodo },
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'storage', label: '存储', icon: FolderOpen },
  { id: 'agents', label: 'Agent', icon: Bot },
  { id: 'cron', label: '定时', icon: Clock },
]

interface Props {
  activeFeature: FeatureView
  onFeatureChange: (feature: FeatureView) => void
  rooms: RoomWithMeta[]
  currentRoomId: string | null
  onRoomSelect: (roomId: string) => void
  onCreateRoom: (name: string, agentIds: string[]) => void
  className?: string
}

export function LeftNavSidebar({ activeFeature, onFeatureChange, rooms, currentRoomId, onRoomSelect, className }: Props) {
  const { user, signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  return (
    <div className={cn('w-[240px] shrink-0 border-r border-border bg-background flex flex-col', className)}>
      {/* Feature navigation */}
      <div className="flex flex-wrap gap-1 px-2 pt-2 pb-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = activeFeature === item.id
          return (
            <button
              key={item.id}
              onClick={() => onFeatureChange(item.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="h-px bg-border mx-2" />

      {/* Room list */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <span className="text-xs font-medium text-muted-foreground">对话</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <RoomList
          rooms={rooms}
          currentRoomId={currentRoomId}
          onSelectRoom={(room) => onRoomSelect(room.id)}
        />
      </div>

      <CreateRoomDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {/* Footer */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-2">
        <span className="flex-1 text-sm truncate">{user?.name || user?.email}</span>
        <button className="relative p-1 rounded hover:bg-muted transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button onClick={signOut} className="p-1 rounded hover:bg-muted transition-colors" title="退出登录">
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
