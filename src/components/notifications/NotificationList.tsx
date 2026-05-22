import { useState } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { useNotifications } from '../../hooks/use-notifications.js'
import { cn } from '../../lib/cn.js'
import { formatTime } from '../../lib/format.js'

interface NotificationListProps {
  className?: string
}

export function NotificationList({ className }: NotificationListProps) {
  const { notifications, loading, markRead, markAllRead, act } = useNotifications()
  const [actingId, setActingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  async function handleAction(id: number, action: 'accept' | 'decline') {
    setActingId(id)
    setActionError('')
    try {
      const result = await act(id, action)
      if (result.error) setActionError(result.error)
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className={cn('flex max-h-[400px] w-[320px] flex-col', className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">通知</span>
        <button onClick={() => markAllRead()} className="text-[10px] text-primary hover:underline">
          全部已读
        </button>
      </div>
      {actionError && (
        <div className="border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {actionError}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">加载中...</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">暂无通知</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={cn(
                'flex items-start gap-2.5 px-3 py-2.5 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors',
                !n.is_read && 'bg-primary/5',
              )}
            >
              <Bell className={cn('w-4 h-4 mt-0.5 shrink-0', n.is_read ? 'text-muted-foreground' : 'text-primary')} />
              <div className="flex-1 min-w-0">
                <div className="break-words text-sm font-medium leading-snug">{n.title}</div>
                {n.content && <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{n.content}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">{formatTime(n.created_at)}</div>
                {n.action_status === 'pending' && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={actingId === n.id}
                      onClick={(event) => { event.stopPropagation(); void handleAction(n.id, 'accept') }}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-[#181d26] px-2 text-xs font-medium text-white hover:bg-[#0d1218] disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      接受
                    </button>
                    <button
                      type="button"
                      disabled={actingId === n.id}
                      onClick={(event) => { event.stopPropagation(); void handleAction(n.id, 'decline') }}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      拒绝
                    </button>
                  </div>
                )}
                {n.action_status && n.action_status !== 'pending' && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {n.action_status === 'accepted' ? '已接受' : n.action_status === 'declined' ? '已拒绝' : '已取消'}
                  </div>
                )}
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
