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

const TASK_TYPE_CONFIG = {
  manual: {
    label: '手动',
    title: '手动任务',
    className: 'border-[#9297a0]/40 bg-[#f8fafc] text-[#41454d]',
  },
  agent: {
    label: 'Agent',
    title: '即时 Agent 任务',
    className: 'border-[#458fff]/30 bg-[#458fff]/10 text-[#254fad]',
  },
  once: {
    label: '计划',
    title: '一次性计划任务',
    className: 'border-amber-300/60 bg-amber-50 text-amber-800',
  },
  recurring: {
    label: '定时',
    title: '周期定时任务实例',
    className: 'border-emerald-300/60 bg-emerald-50 text-emerald-800',
  },
  dependency: {
    label: '依赖',
    title: '多步骤依赖任务',
    className: 'border-[#aa2d00]/25 bg-[#aa2d00]/10 text-[#aa2d00]',
  },
} as const

interface Props {
  task: Task
  onClick?: () => void
  onDelete?: () => void
  assignedLabel?: string
  className?: string
}

export function TaskItem({ task, onClick, onDelete, assignedLabel, className }: Props) {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
  const awaitingVerification = task.verification_status === 'pending' || task.scheduler_state === 'awaiting_verify'
  const waitingAssignment = task.status === 'pending' && task.scheduler_state === 'manual' && !task.assigned_agent_id
  const displayConfig = awaitingVerification
    ? { icon: CheckCircle2, color: 'text-amber-500', label: '待验收', variant: 'warning' as const }
    : waitingAssignment
      ? { icon: Clock, color: 'text-muted-foreground', label: '待分配', variant: 'outline' as const }
    : config
  const Icon = displayConfig.icon
  const typeConfig = getTaskTypeConfig(task)

  return (
    <div className={cn('group mb-2 flex items-start gap-3 rounded-lg border border-border bg-white p-3 transition-colors hover:bg-muted', className)}>
      <button type="button" onClick={onClick} className="mt-0.5 shrink-0">
        <Icon className={cn('w-4 h-4', config.color)} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <TaskTypeBadge config={typeConfig} />
          <button type="button" onClick={onClick} className="block min-w-0 flex-1 truncate text-left text-sm">{task.title}</button>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {(assignedLabel || task.assigned_name || task.assigned_agent_id) && (
            <span className="text-[10px] text-muted-foreground">@{assignedLabel || task.assigned_name || task.assigned_agent_id}</span>
          )}
          <Badge variant={displayConfig.variant} className="text-[10px] px-1.5 py-0">{displayConfig.label}</Badge>
          {task.scheduler_state === 'pending_deps' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">等待依赖</Badge>
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

function getTaskTypeConfig(task: Task) {
  if (task.scheduler_state === 'pending_deps' || (task.depends_on_task_ids && task.depends_on_task_ids.length > 0)) {
    return TASK_TYPE_CONFIG.dependency
  }
  if (task.parent_task_id && task.schedule_id) {
    return TASK_TYPE_CONFIG.recurring
  }
  if (task.schedule_id || task.scheduler_state === 'waiting_time' || task.scheduled_start_at) {
    return TASK_TYPE_CONFIG.once
  }
  if (task.assigned_agent_id) {
    return TASK_TYPE_CONFIG.agent
  }
  return TASK_TYPE_CONFIG.manual
}

function TaskTypeBadge({ config }: { config: typeof TASK_TYPE_CONFIG[keyof typeof TASK_TYPE_CONFIG] }) {
  return (
    <Badge
      variant="outline"
      title={config.title}
      className={cn('h-5 shrink-0 px-1.5 py-0 text-[10px] font-medium leading-none', config.className)}
    >
      {config.label}
    </Badge>
  )
}
