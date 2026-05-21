import { useEffect, useState, type ReactNode } from 'react'
import { MessageSquareText, BookOpen, ListChecks, Plus, LogOut, Bell, Hash, Shield, User } from 'lucide-react'
import type { FeatureView, ChannelWithMeta } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useAppConfig } from '../../hooks/use-app-config.js'
import { useNotifications } from '../../hooks/use-notifications.js'
import { CreateChannelDialog } from '../channels/CreateChannelDialog.js'
import { ProfileModal } from '../user/ProfileModal.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'

interface NavItem { id: FeatureView; label: string; icon: React.ElementType }

const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'tasks', label: '任务', icon: ListChecks },
]

interface Props {
  activeFeature: FeatureView
  onFeatureChange: (feature: FeatureView) => void
  channels: ChannelWithMeta[]
  currentChannelId: string | null
  onChannelSelect: (channelId: string) => void
  footerMeta?: ReactNode
  className?: string
}

export function LeftNavSidebar({ activeFeature, onFeatureChange, channels, currentChannelId, onChannelSelect, footerMeta, className }: Props) {
  const { user, signOut } = useAuth()
  const { branding } = useAppConfig()
  const { unreadCount } = useNotifications()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const isAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin'
  const navItems = isAdmin ? [...BASE_NAV_ITEMS, { id: 'admin' as const, label: '管理后台', icon: Shield }] : BASE_NAV_ITEMS
  const brandInitial = Array.from(branding.title)[0] || 'B'
  const hasLogo = Boolean(branding.logo && !logoFailed)

  useEffect(() => {
    setLogoFailed(false)
  }, [branding.logo])

  return (
    <div className={cn('w-[200px] shrink-0 border-r border-border bg-white flex flex-col', className)}>
      <div className="px-3 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5">
          {hasLogo ? (
            <img
              src={branding.logo}
              alt={branding.title}
              className="h-10 w-auto max-w-[176px] shrink-0 rounded-md object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#181d26] text-xs font-medium text-white">
              {brandInitial}
            </div>
          )}
          {!hasLogo && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[#181d26]" title={branding.title}>{branding.title}</div>
            </div>
          )}
        </div>
      </div>

      {/* Top nav actions */}
      <div className="px-3 pb-2 space-y-0.5">
        <button
          onClick={() => { onFeatureChange('chat'); setCreateDialogOpen(true) }}
          className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-black/5 transition-colors"
        >
          <MessageSquareText className="w-4 h-4 text-muted-foreground" />
          <span>新建频道</span>
        </button>

        {navItems.map((item) => {
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

      {/* Channel list section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
          <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">频道</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="p-1 rounded hover:bg-black/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-px" data-testid="app-channel-list">
          {channels.map((channel) => {
            const active = channel.id === currentChannelId
            return (
              <button
                key={channel.id}
                data-testid="app-channel-item"
                data-channel-id={channel.id}
                data-channel-name={channel.name || '对话'}
                onClick={() => { onChannelSelect(channel.id); onFeatureChange('chat') }}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors group',
                  active ? 'bg-black/[0.07] text-foreground font-medium' : 'text-foreground/70 hover:bg-black/[0.04]',
                )}
              >
                <Hash className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                <span className="flex-1 truncate text-left">{channel.name || '对话'}</span>
                {channel.unread_count > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium shrink-0">
                    {channel.unread_count > 99 ? '99' : channel.unread_count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <CreateChannelDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />

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
        {footerMeta && (
          <div className="mt-2 border-t border-border/60 pt-2">
            {footerMeta}
          </div>
        )}

        {/* User menu popover */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-2 mb-1 z-50 w-48 rounded-lg border border-border bg-white shadow-lg py-1">
              <button
                onClick={() => { setMenuOpen(false); setProfileOpen(true) }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[#555] hover:bg-[#f5f5f5] hover:text-[#1a1a1a] transition-colors"
              >
                <User className="w-4 h-4" />
                个人中心
              </button>
              {isAdmin && (
                <button
                  onClick={() => { setMenuOpen(false); onFeatureChange('admin') }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[#555] hover:bg-[#f5f5f5] hover:text-[#1a1a1a] transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  管理后台
                </button>
              )}
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
    </div>
  )
}
