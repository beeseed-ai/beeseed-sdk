import { Bell } from 'lucide-react'
import { useNotifications } from '../../hooks/use-notifications.js'
import { cn } from '../../lib/cn.js'
import { formatTime } from '../../lib/format.js'

export function NotificationList() {
  const { notifications, loading, markRead, markAllRead } = useNotifications()

  return (
    <div className="flex flex-col max-h-[400px] w-[320px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">通知</span>
        <button onClick={() => markAllRead()} className="text-[10px] text-primary hover:underline">
          全部已读
        </button>
      </div>
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
                <div className="text-sm font-medium">{n.title}</div>
                {n.content && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.content}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">{formatTime(n.created_at)}</div>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
