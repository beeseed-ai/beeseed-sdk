import { AlertTriangle, Ban, CheckCircle2, Circle, Clock, Trash2 } from 'lucide-react'
import type { Task } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'

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
  onDelete?: () => void
  assignedLabel?: string
  className?: string
}

export function TaskItem({ task, onClick, onDelete, assignedLabel, className }: Props) {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
  const Icon = config.icon
  const awaitingVerification = task.verification_status === 'pending' || task.scheduler_state === 'awaiting_verify'

  return (
    <div className={cn('group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors', className)}>
      <button type="button" onClick={onClick} className="mt-0.5 shrink-0">
        <Icon className={cn('w-4 h-4', config.color)} />
      </button>
      <div className="flex-1 min-w-0">
        <button type="button" onClick={onClick} className="block w-full text-left text-sm truncate">{task.title}</button>
        <div className="flex items-center gap-2 mt-0.5">
          {(assignedLabel || task.assigned_name || task.assigned_agent_id) && (
            <span className="text-[10px] text-muted-foreground">@{assignedLabel || task.assigned_name || task.assigned_agent_id}</span>
          )}
          <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">{config.label}</Badge>
          {task.scheduler_state === 'pending_deps' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">等待依赖</Badge>
          )}
          {awaitingVerification && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">待验收</Badge>
          )}
          {task.failure_code && (
            <span className="max-w-[120px] truncate text-[10px] text-destructive">{task.failure_code}</span>
          )}
          {task.depends_on_task_ids && task.depends_on_task_ids.length > 0 && (
            <span className="text-[10px] text-muted-foreground">依赖 {task.depends_on_task_ids.length}</span>
          )}
          {task.due_at && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(task.due_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      {onDelete && (
        <Button
          size="icon-sm"
          variant="ghost"
          title="删除"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      )}
    </div>
  )
}
