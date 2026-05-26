import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MessageSquareText, BookOpen, ListChecks, Plus, LogOut, Bell, Hash, Shield, User, Trash2 } from 'lucide-react'
import type { FeatureView, ChannelWithMeta } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useAppConfig } from '../../hooks/use-app-config.js'
import { useNotifications } from '../../hooks/use-notifications.js'
import { useChannels } from '../../hooks/use-channels.js'
import { CreateChannelDialog } from '../channels/CreateChannelDialog.js'
import { NotificationList } from '../notifications/NotificationList.js'
import { ProfileModal } from '../user/ProfileModal.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'

interface NavItem { id: FeatureView; label: string; icon: React.ElementType }

const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'tasks', label: '任务', icon: ListChecks },
]

function isTemplateManagedChannel(channel: ChannelWithMeta): boolean {
  if (!channel.settings) return false
  try {
    const settings = JSON.parse(channel.settings) as {
      channel_template?: { managed?: boolean; source?: string }
    }
    const template = settings.channel_template
    if (!template || typeof template !== 'object') return false
    if (template.source === 'user') return false
    if (typeof template.managed === 'boolean') return template.managed
    return true
  } catch {
    return false
  }
}

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
  const { deleteChannel } = useChannels()
  const { unreadCount } = useNotifications()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const isAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin'
  const navItems = isAdmin ? [...BASE_NAV_ITEMS, { id: 'admin' as const, label: '管理后台', icon: Shield }] : BASE_NAV_ITEMS
  const brandInitial = Array.from(branding.title)[0] || 'B'
  const hasLogo = Boolean(branding.logo && !logoFailed)
  const channelSections = useMemo(() => {
    const owned: ChannelWithMeta[] = []
    const joined: ChannelWithMeta[] = []

    for (const channel of channels) {
      if (!user?.id || channel.created_by === user.id) owned.push(channel)
      else joined.push(channel)
    }

    const hasJoinedChannels = joined.length > 0

    return [
      ...(owned.length > 0 ? [{ id: 'owned', label: hasJoinedChannels ? '我的频道' : '', channels: owned }] : []),
      ...(joined.length > 0 ? [{ id: 'joined', label: '加入的频道', channels: joined }] : []),
    ]
  }, [channels, user?.id])

  async function handleDeleteChannel(channel: ChannelWithMeta) {
    const name = channel.name || '对话'
    if (!window.confirm(`删除频道「${name}」？单人频道会从列表移除，多人频道需要到管理后台删除。`)) return
    const result = await deleteChannel(channel.id)
    if (result.error) window.alert(result.error)
  }

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
                active ? 'bg-[#181d26] text-white font-medium shadow-sm' : 'text-[#41454d] hover:bg-black/5 hover:text-[#181d26]',
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

        <div className="flex-1 overflow-y-auto px-2 pb-2" data-testid="app-channel-list">
          {channels.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground/70">暂无频道</div>
          ) : channelSections.map((section) => (
            <section key={section.id} className="space-y-px">
              {section.label && (
                <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground/65">
                  {section.label}
                </div>
              )}
              {section.channels.map((channel) => {
                const active = activeFeature === 'chat' && channel.id === currentChannelId
                const isProtectedTemplateChannel = isTemplateManagedChannel(channel)
                const canDelete = Boolean(user?.id && channel.created_by === user.id && (!isProtectedTemplateChannel || isAdmin))
                return (
                  <div
                    key={channel.id}
                    data-testid="app-channel-item"
                    data-channel-id={channel.id}
                    data-channel-name={channel.name || '对话'}
                    data-channel-section={section.id}
                    className={cn(
                      'group flex items-center gap-1 rounded-md transition-colors',
                      active ? 'bg-[#181d26] text-white font-medium shadow-sm' : 'text-[#41454d] hover:bg-black/[0.04] hover:text-[#181d26]',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => { onChannelSelect(channel.id); onFeatureChange('chat') }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                    >
                      <Hash className={cn('w-3.5 h-3.5 shrink-0', active ? 'text-white/75' : 'text-muted-foreground/50')} />
                      <span className="flex-1 truncate text-left">{channel.name || '对话'}</span>
                      {channel.unread_count > 0 && (
                        <span className={cn(
                          'w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-medium shrink-0',
                          active ? 'bg-white text-[#181d26]' : 'bg-primary text-primary-foreground',
                        )}>
                          {channel.unread_count > 99 ? '99' : channel.unread_count}
                        </span>
                      )}
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        title="删除频道"
                        aria-label={`删除频道 ${channel.name || '对话'}`}
                        onClick={() => void handleDeleteChannel(channel)}
                        className={cn(
                          'mr-1 hidden size-6 shrink-0 items-center justify-center rounded group-hover:flex focus:flex',
                          active ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-red-50 hover:text-red-600',
                        )}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
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
          <button
            type="button"
            className="relative p-1 rounded hover:bg-black/5 transition-colors"
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
        {notificationsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
            <div className="absolute bottom-0 left-[calc(100%+8px)] z-50 w-[min(380px,calc(100vw-224px))] overflow-hidden rounded-lg border border-border bg-white shadow-lg">
              <NotificationList className="max-h-[min(480px,calc(100vh-96px))] w-full" />
            </div>
          </>
        )}
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
