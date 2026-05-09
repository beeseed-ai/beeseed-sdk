import { Circle, CheckCircle2, Clock, AlertTriangle, Ban } from 'lucide-react'
import type { Task } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { Badge } from '../ui/badge.js'

const STATUS_CONFIG = {
  pending: { icon: Circle, color: 'text-muted-foreground', label: '待处理', variant: 'outline' as const },
  in_progress: { icon: Clock, color: 'text-blue-500', label: '进行中', variant: 'default' as const },
  done: { icon: CheckCircle2, color: 'text-green-500', label: '已完成', variant: 'success' as const },
  failed: { icon: AlertTriangle, color: 'text-red-500', label: '失败', variant: 'destructive' as const },
  blocked: { icon: Ban, color: 'text-amber-500', label: '阻塞', variant: 'warning' as const },
}

interface Props {
  task: Task
  onClick?: () => void
  className?: string
}

export function TaskItem({ task, onClick, className }: Props) {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
  const Icon = config.icon

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
        className,
      )}
    >
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', config.color)} />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{task.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.assigned_name && (
            <span className="text-[10px] text-muted-foreground">@{task.assigned_name}</span>
          )}
          <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">{config.label}</Badge>
          {task.due_at && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(task.due_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
