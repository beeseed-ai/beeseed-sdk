import { useMemo } from 'react'
import { AlertTriangle, Check, Circle, MinusCircle } from 'lucide-react'
import type { AgentLoopState, AgentTodoItem, ChannelMemberInfo, StreamState } from '../../core/types.js'
import { cn } from '../../lib/cn.js'

interface Props {
  loops?: AgentLoopState[]
  streams?: StreamState[]
  members?: ChannelMemberInfo[]
  className?: string
}

interface TodoRun {
  key: string
  loop: AgentLoopState
  todos: AgentTodoItem[]
  activityAt: number
}

function todoTimestamp(todo: AgentTodoItem): number {
  const raw = todo.updated_at || todo.completed_at
  if (!raw) return 0
  const value = new Date(raw).getTime()
  return Number.isFinite(value) ? value : 0
}

function loopActivityAt(loop: AgentLoopState): number {
  let latest = loop.completedAt ?? loop.startedAt ?? 0
  for (const todo of loop.todos ?? []) {
    latest = Math.max(latest, todoTimestamp(todo))
  }
  for (const event of loop.events ?? []) {
    latest = Math.max(latest, event.timestamp)
  }
  for (const turn of loop.turns) {
    latest = Math.max(latest, turn.completedAt ?? turn.startedAt ?? 0)
  }
  return latest
}

function isActiveLoop(loop: AgentLoopState): boolean {
  return loop.status === 'running' || loop.status === 'waiting_for_user'
}

function collectTodoRuns(loops?: AgentLoopState[], streams?: StreamState[]): TodoRun[] {
  const byAgent = new Map<string, TodoRun>()

  const addLoop = (loop?: AgentLoopState) => {
    const todos = loop?.todos?.length ? [...loop.todos].sort((a, b) => a.seq - b.seq) : []
    if (!loop || todos.length === 0) return
    const key = loop.agentId
    const activityAt = loopActivityAt(loop)
    const existing = byAgent.get(key)
    if (!existing) {
      byAgent.set(key, { key, loop, todos, activityAt })
      return
    }

    const existingActive = isActiveLoop(existing.loop)
    const nextActive = isActiveLoop(loop)
    if ((nextActive && !existingActive) || (nextActive === existingActive && activityAt >= existing.activityAt)) {
      byAgent.set(key, { key, loop, todos, activityAt })
    }
  }

  loops?.forEach(addLoop)
  streams?.forEach((stream) => addLoop(stream.agentLoop))

  return [...byAgent.values()].sort((a, b) => {
    const aActive = isActiveLoop(a.loop) ? 1 : 0
    const bActive = isActiveLoop(b.loop) ? 1 : 0
    if (aActive !== bActive) return bActive - aActive
    return b.activityAt - a.activityAt
  })
}

function memberDisplayName(member: ChannelMemberInfo): string {
  return member.display_name || member.nickname || member.agent_id || member.user_id || 'Agent'
}

function agentMember(members: ChannelMemberInfo[] | undefined, agentId: string): ChannelMemberInfo | undefined {
  return members?.find((member) => member.member_type === 'agent' && member.agent_id === agentId)
}

function isFinishedTodo(todo: AgentTodoItem): boolean {
  return todo.status === 'completed' || todo.status === 'skipped'
}

function isFinishedRun(run: TodoRun): boolean {
  return run.todos.length > 0 && run.todos.every(isFinishedTodo)
}

function TodoStatusIcon({ status }: { status: AgentTodoItem['status'] }) {
  if (status === 'completed') return <Check className="size-3.5 text-[#006400]" />
  if (status === 'in_progress') {
    return (
      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex size-3 rounded-full bg-[#181d26]/15 animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-[#181d26]" />
      </span>
    )
  }
  if (status === 'blocked') return <AlertTriangle className="size-3.5 text-amber-600" />
  if (status === 'skipped') return <MinusCircle className="size-3.5 text-[#999]" />
  return <Circle className="size-3.5 text-muted-foreground/40" />
}

function TodoRow({ todo }: { todo: AgentTodoItem }) {
  const detail = [todo.title, todo.blocker ? `阻塞：${todo.blocker}` : '', todo.evidence ? `结果：${todo.evidence}` : '']
    .filter(Boolean)
    .join('\n')

  return (
    <div className="flex min-h-6 min-w-0 items-start gap-2 py-0.5 text-xs" title={detail}>
      <TodoStatusIcon status={todo.status} />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[#181d26]',
          todo.status === 'completed' && 'text-[#777169] line-through',
          todo.status === 'skipped' && 'text-[#999]',
        )}
      >
        {todo.title}
      </span>
    </div>
  )
}

function TodoRunBlock({ run, members }: { run: TodoRun; members?: ChannelMemberInfo[] }) {
  const member = agentMember(members, run.loop.agentId)
  const displayName = member ? memberDisplayName(member) : run.loop.agentId
  const finishedCount = run.todos.filter(isFinishedTodo).length
  const active = isActiveLoop(run.loop)

  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center gap-2 rounded-md bg-[#f8fafc] px-2 py-1.5">
        <span className={cn('size-1.5 shrink-0 rounded-full', active ? 'bg-[#181d26]' : 'bg-[#999]')} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#181d26]">{displayName}</span>
        <span className="shrink-0 text-xs text-[#777169]">{finishedCount}/{run.todos.length}</span>
      </div>
      <div className="space-y-0.5 pl-5">
        {run.todos.map((todo) => <TodoRow key={todo.id} todo={todo} />)}
      </div>
    </div>
  )
}

export function AgentTodoRail({ loops, streams, members, className }: Props) {
  const runs = useMemo(() => collectTodoRuns(loops, streams), [loops, streams])
  const visibleRuns = useMemo(() => runs.filter((run) => !isFinishedRun(run)), [runs])

  if (runs.length === 0) return null
  if (visibleRuns.length === 0) return null

  return (
    <aside
      className={cn(
        'pointer-events-none w-[min(340px,calc(100vw-2rem))] text-[#181d26]',
        className,
      )}
      aria-label="Agent TODO List"
    >
      <div className="pointer-events-auto max-h-[42dvh] overflow-y-auto px-1 py-1">
        <div className="space-y-3">
          {visibleRuns.map((run) => <TodoRunBlock key={run.key} run={run} members={members} />)}
        </div>
      </div>
    </aside>
  )
}
