import { useState, useRef } from 'react'
import { MessageSquareText, Bot, BookOpen, HardDrive, ListChecks, Plus, MoreHorizontal, LogOut, Bell, Hash, Shield, Camera } from 'lucide-react'
import type { FeatureView, RoomWithMeta } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useNotifications } from '../../hooks/use-notifications.js'
import { CreateRoomDialog } from '../rooms/CreateRoomDialog.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'

interface NavItem { id: FeatureView; label: string; icon: React.ElementType }

const NAV_ITEMS: NavItem[] = [
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'storage', label: '云盘', icon: HardDrive },
  { id: 'tasks', label: '任务', icon: ListChecks },
  { id: 'agents', label: 'Agent 员工', icon: Bot },
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
  const { user, signOut, updateAvatar } = useAuth()
  const { unreadCount } = useNotifications()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await updateAvatar(file)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  return (
    <div className={cn('w-[200px] shrink-0 border-r border-border bg-[#fafaf8] flex flex-col', className)}>
      {/* Top nav actions */}
      <div className="px-3 pt-4 pb-2 space-y-0.5">
        <button
          onClick={() => { onFeatureChange('chat'); setCreateDialogOpen(true) }}
          className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-black/5 transition-colors"
        >
          <MessageSquareText className="w-4 h-4 text-muted-foreground" />
          <span>新建群聊</span>
        </button>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = activeFeature === item.id
          return (
            <button
              key={item.id}
              onClick={() => onFeatureChange(item.id)}
              className={cn(
                'flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm transition-colors',
                active ? 'bg-black/5 text-foreground font-medium' : 'text-foreground/70 hover:bg-black/5',
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Room list section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
          <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">群聊</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="p-1 rounded hover:bg-black/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button className="p-1 rounded hover:bg-black/5 transition-colors">
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-px">
          {rooms.map((room) => {
            const active = room.id === currentRoomId
            return (
              <button
                key={room.id}
                onClick={() => { onRoomSelect(room.id); onFeatureChange('chat') }}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors group',
                  active ? 'bg-black/[0.07] text-foreground font-medium' : 'text-foreground/70 hover:bg-black/[0.04]',
                )}
              >
                <Hash className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                <span className="flex-1 truncate text-left">{room.name || '对话'}</span>
                {room.unread_count > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium shrink-0">
                    {room.unread_count > 99 ? '99' : room.unread_count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <CreateRoomDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {/* Footer */}
      <div className="border-t border-border px-3 py-2.5 relative">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 flex-1 min-w-0 rounded-md p-1 -m-1 hover:bg-black/5 transition-colors"
          >
            <Avatar className="size-7 shrink-0">
              {user?.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{user?.name?.[0] || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
            </div>
          </button>
          <button className="relative p-1 rounded hover:bg-black/5 transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* User menu popover */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-2 mb-1 z-50 w-48 rounded-lg border border-border bg-white shadow-lg py-1">
              <button
                onClick={() => { setMenuOpen(false); avatarInputRef.current?.click() }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[#555] hover:bg-[#f5f5f5] hover:text-[#1a1a1a] transition-colors"
              >
                <Camera className="w-4 h-4" />
                更换头像
              </button>
              <button
                onClick={() => { setMenuOpen(false); onFeatureChange(isAdmin ? 'admin' : 'agents') }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[#555] hover:bg-[#f5f5f5] hover:text-[#1a1a1a] transition-colors"
              >
                {isAdmin ? <Shield className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                {isAdmin ? '管理面板' : 'Agent 管理'}
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => { setMenuOpen(false); signOut() }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </>
        )}
      </div>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleAvatarUpload}
      />
    </div>
  )
}
