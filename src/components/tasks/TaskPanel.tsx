import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Hash, PauseCircle, PlayCircle, Repeat2, Timer, Trash2 } from 'lucide-react'
import { useTasks } from '../../hooks/use-tasks.js'
import { useChannels } from '../../hooks/use-channels.js'
import type { CalendarEvent, ChannelMemberInfo, Task, TaskSchedulerMetrics } from '../../core/types.js'
import type { CreateScheduledTaskInput } from '../../stores/tasks.js'
import { TaskItem } from './TaskItem.js'
import { CreateTaskDialog } from './CreateTaskDialog.js'
import { CreateScheduledTaskDialog } from './CreateScheduledTaskDialog.js'
import { TaskDetailSheet } from './TaskDetailSheet.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'
import { DropdownItem, DropdownMenu } from '../ui/dropdown-menu.js'
import { cn } from '../../lib/cn.js'

interface Props {
  channelId: string | null
  members?: ChannelMemberInfo[]
  createTaskRequest?: number
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function TaskPanel({ channelId, members = [], createTaskRequest = 0 }: Props) {
  const { channels, joinChannel } = useChannels()
  const {
    projects, tasks, scheduledTasks, calendarEvents, metrics, loading, schedulesLoading, metricsLoading,
    getTask, createTask, createScheduledTask, updateScheduledTask, deleteScheduledTask, deleteTask, fetchScheduledTasks, fetchCalendar, fetchMetrics,
  } = useTasks(channelId)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('tasks')

  const calendarRange = useMemo(() => getCalendarRange(calendarMonth), [calendarMonth])
  const currentChannel = channels.find((channel) => channel.id === channelId)
  const agentMembers = members.filter((member) => member.member_type === 'agent' && member.agent_id)
  const agentNames = new Map(agentMembers.map((agent) => [agent.agent_id, agent.display_name || agent.agent_id || 'Agent']))

  useEffect(() => {
    if (!channelId) return
    void fetchCalendar({
      from: calendarRange.gridStart.toISOString(),
      to: calendarRange.gridEnd.toISOString(),
    })
  }, [channelId, calendarRange.gridStart, calendarRange.gridEnd])

  if (!channelId) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#fafafa]">
        <div className="mx-auto max-w-5xl space-y-4 p-4 sm:space-y-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-[#1a1a1a]">当前对话任务</h1>
            <ChannelSwitcher channels={channels} currentChannelId={channelId} onSelect={joinChannel} />
          </div>
          <div className="flex h-[320px] items-center justify-center rounded-xl border border-border bg-white text-sm text-muted-foreground shadow-sm">
            选择一个频道查看任务
          </div>
        </div>
      </div>
    )
  }

  const groupedByProject = projects.map((proj) => ({
    project: proj,
    tasks: tasks.filter((t) => t.project_id === proj.id),
  })).filter(({ tasks: pTasks }) => pTasks.length > 0)
  const orphanTasks = tasks.filter((t) => !t.project_id)
  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) || null : null
  const oneTimeCalendarEvents = calendarEvents.filter((event) => !event.is_recurring)
  const recurringSchedules = scheduledTasks.filter((schedule) => schedule.kind === 'recurring')
  const selectedEvents = oneTimeCalendarEvents
    .filter((event) => isSameLocalDay(new Date(event.start_at), selectedDate))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  const openTask = (task: Task) => setSelectedTaskId(task.id)
  const openEventTask = (event: CalendarEvent) => {
    if (!event.task_id) return
    const existing = tasks.find((task) => task.id === event.task_id)
    if (!existing) {
      void getTask(event.task_id)
    }
    setSelectedTaskId(event.task_id)
  }
  const refreshCalendarRange = () => fetchCalendar({
    from: calendarRange.gridStart.toISOString(),
    to: calendarRange.gridEnd.toISOString(),
  })
  const handleCreateTask = async (data: Parameters<typeof createTask>[0]) => {
    setActiveTab('tasks')
    const task = await createTask(data)
    if (task?.due_at || task?.scheduled_start_at) {
      await refreshCalendarRange()
    }
    await fetchMetrics()
  }
  const handleCreateScheduledTask = async (data: Parameters<typeof createScheduledTask>[0]) => {
    const created = await createScheduledTask(data)
    if (created) {
      setActiveTab(isRecurringScheduleInput(data) ? 'schedules' : 'calendar')
      await fetchScheduledTasks()
      await refreshCalendarRange()
      await fetchMetrics()
    }
  }
  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    await updateScheduledTask(scheduleId, { enabled })
    await fetchScheduledTasks()
    await refreshCalendarRange()
    await fetchMetrics()
  }
  const handleDeleteSchedule = async (scheduleId: string) => {
    await deleteScheduledTask(scheduleId)
    await refreshCalendarRange()
    await fetchMetrics()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">当前对话任务</h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Hash className="w-3 h-3" />
            <span className="truncate">{currentChannel?.name || '未命名频道'}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <ChannelSwitcher channels={channels} currentChannelId={channelId} onSelect={joinChannel} />
          <CreateScheduledTaskDialog agents={agentMembers} onSubmit={handleCreateScheduledTask} />
          <CreateTaskDialog agents={agentMembers} onSubmit={handleCreateTask} requestOpenKey={createTaskRequest} />
        </div>
      </div>
      <Tabs defaultValue="tasks" value={activeTab} onValueChange={setActiveTab} className="m-3 flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm sm:m-6">
        <div className="border-b border-border px-3 py-2">
          <TaskMetricsStrip metrics={metrics} loading={metricsLoading} />
          <TabsList className="w-full">
            <TabsTrigger value="tasks" className="flex-1 gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />任务清单<TabCountBadge count={tasks.length} tone="focus" /></TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1 gap-1.5"><CalendarClock className="w-3.5 h-3.5" />日历<TabCountBadge count={oneTimeCalendarEvents.length} tone="calendar" /></TabsTrigger>
            <TabsTrigger value="schedules" className="flex-1 gap-1.5"><Repeat2 className="w-3.5 h-3.5" />重复任务<TabCountBadge count={recurringSchedules.length} tone="repeat" /></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">暂无任务</div>
          ) : (
            <>
              {groupedByProject.map(({ project, tasks: pTasks }) => (
                <div key={project.id} className="mb-3">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className="text-xs font-medium text-muted-foreground">{project.title}</span>
                    <span className="text-[10px] text-muted-foreground/60">{project.done_count}/{project.task_count}</span>
                  </div>
                  {pTasks.map((task) => (
                    <TaskItem key={task.id} task={task} assignedLabel={task.assigned_agent_id ? agentNames.get(task.assigned_agent_id) : undefined} onClick={() => openTask(task)} onDelete={() => deleteTask(task.id)} />
                  ))}
                </div>
              ))}
              {orphanTasks.length > 0 && (
                <div className="mb-3">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">未分组</div>
                  {orphanTasks.map((task) => (
                    <TaskItem key={task.id} task={task} assignedLabel={task.assigned_agent_id ? agentNames.get(task.assigned_agent_id) : undefined} onClick={() => openTask(task)} onDelete={() => deleteTask(task.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="flex-1 overflow-y-auto bg-[#fbfcfd] p-3 sm:p-5">
          <CalendarMonth
            month={calendarMonth}
            selectedDate={selectedDate}
            events={oneTimeCalendarEvents}
            onSelectDate={setSelectedDate}
            onPreviousMonth={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
            onNextMonth={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
            onToday={() => {
              const today = startOfDay(new Date())
              setCalendarMonth(startOfMonth(today))
              setSelectedDate(today)
            }}
          />
          <div className="mt-4 rounded-lg border border-border bg-white px-3 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <div>
                <div className="text-sm font-semibold text-[#181d26]">{formatDayTitle(selectedDate)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {selectedEvents.length > 0 ? `${selectedEvents.length} 个日程` : '没有安排'}
                </div>
              </div>
            </div>
            {selectedEvents.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">当天无任务</div>
            ) : (
              <div className="mt-3 space-y-2">
                {selectedEvents.map((event) => (
                  <CalendarEventRow
                    key={event.id}
                    event={event}
                    onOpenTask={event.task_id ? () => openEventTask(event) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="schedules" className="flex-1 overflow-y-auto p-3">
          {schedulesLoading ? (
            <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
          ) : recurringSchedules.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">暂无重复任务</div>
          ) : (
            <div className="space-y-1">
              {recurringSchedules.map((schedule) => (
                <div key={schedule.id} className="rounded-md px-2 py-2 hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{schedule.template_title || schedule.recurrence_rule || formatDateTime(schedule.run_at)}</div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{schedule.kind === 'recurring' ? '重复' : '一次'}</span>
                        {schedule.next_fire_at && <span>{formatDateTime(schedule.next_fire_at)}</span>}
                        {schedule.recurrence_rule && <span className="truncate">{schedule.recurrence_rule}</span>}
                        {schedule.assigned_agent_id && <span>@{agentNames.get(schedule.assigned_agent_id) || schedule.assigned_agent_id}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={schedule.enabled ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                        {schedule.enabled ? '启用' : '停用'}
                      </Badge>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title={schedule.enabled ? '停用' : '启用'}
                        onClick={() => handleToggleSchedule(schedule.id, !schedule.enabled)}
                      >
                        {schedule.enabled ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="删除"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <TaskDetailSheet
        channelId={channelId}
        task={selectedTask}
        members={members}
        channelName={currentChannel?.name || undefined}
        open={!!selectedTask}
        onClose={() => setSelectedTaskId(null)}
        onTaskChanged={() => {
          void refreshCalendarRange()
          void fetchMetrics()
        }}
      />
    </div>
  )
}

function TaskMetricsStrip({ metrics, loading }: { metrics: TaskSchedulerMetrics | null; loading: boolean }) {
  const items = [
    { key: 'open', label: '打开', value: metrics?.open ?? 0, icon: Activity },
    { key: 'ready', label: '待派发', value: metrics?.ready ?? 0, icon: Timer },
    { key: 'dispatched', label: '执行中', value: metrics?.dispatched ?? 0, icon: PlayCircle },
    { key: 'verify', label: '待验收', value: metrics?.awaiting_verify ?? 0, icon: CheckCircle2 },
    { key: 'risk', label: '异常', value: (metrics?.overdue ?? 0) + (metrics?.failed_24h ?? 0), icon: AlertTriangle },
  ]

  return (
    <div className="mb-2 grid grid-cols-5 gap-1">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.key} className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
            <div className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
              {loading ? '...' : item.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChannelSwitcher({
  channels,
  currentChannelId,
  onSelect,
}: {
  channels: ReturnType<typeof useChannels>['channels']
  currentChannelId: string | null
  onSelect: (channelId: string) => void
}) {
  const currentChannel = channels.find((channel) => channel.id === currentChannelId)

  return (
    <DropdownMenu
      align="end"
      className="max-h-72 w-64 overflow-y-auto"
      trigger={(
        <Button size="sm" variant="outline" className="max-w-[180px] justify-between gap-2">
          <span className="truncate">{currentChannel?.name || '选择频道'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      )}
    >
      {channels.length === 0 ? (
        <div className="px-2 py-2 text-sm text-muted-foreground">暂无频道</div>
      ) : (
        channels.map((channel) => (
          <DropdownItem
            key={channel.id}
            onClick={() => onSelect(channel.id)}
            className={cn('justify-between', channel.id === currentChannelId && 'bg-muted font-medium')}
          >
            <span className="min-w-0 truncate">{channel.name || '未命名频道'}</span>
            {channel.unread_count > 0 && (
              <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-primary-foreground">
                {channel.unread_count > 99 ? '99' : channel.unread_count}
              </span>
            )}
          </DropdownItem>
        ))
      )}
    </DropdownMenu>
  )
}

function TabCountBadge({ count, tone }: { count: number; tone: 'focus' | 'calendar' | 'repeat' }) {
  return (
    <span
      className={cn(
        'ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[10px] font-semibold leading-none',
        tone === 'focus' && 'border-[#9297a0]/45 bg-[#181d26] text-white',
        tone === 'calendar' && 'border-amber-200 bg-amber-50 text-amber-800',
        tone === 'repeat' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
      )}
    >
      {count}
    </span>
  )
}

function isRecurringScheduleInput(data: CreateScheduledTaskInput) {
  return Boolean(data.cron_expr?.trim() || data.recurrence_rule?.trim())
}

function CalendarMonth({
  month,
  selectedDate,
  events,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
  onToday,
}: {
  month: Date
  selectedDate: Date
  events: CalendarEvent[]
  onSelectDate: (date: Date) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}) {
  const range = getCalendarRange(month)

  return (
    <div className="rounded-lg border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Button size="icon-sm" variant="ghost" title="上个月" onClick={onPreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" title="下个月" onClick={onNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="min-w-[10rem] text-center">
          <div className="text-lg font-semibold text-[#181d26]">{formatMonthTitle(month)}</div>
          <div className="text-xs text-muted-foreground">点击日期查看当天任务</div>
        </div>
        <Button size="sm" variant="outline" onClick={onToday}>今天</Button>
      </div>
      <div className="grid grid-cols-7 border-l border-t border-border">
        {WEEKDAYS.map((day) => (
          <div key={day} className="border-r border-b border-border bg-[#f8fafc] py-2 text-center text-xs font-semibold text-[#41454d]">
            {day}
          </div>
        ))}
        {range.days.map((date) => {
          const dayEvents = events.filter((event) => isSameLocalDay(new Date(event.start_at), date))
          const inMonth = date.getMonth() === month.getMonth()
          const selected = isSameLocalDay(date, selectedDate)
          const today = isSameLocalDay(date, new Date())
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelectDate(date)}
              aria-label={`${formatDayTitle(date)}，${dayEvents.length} 个日程`}
              className={cn(
                'min-h-[112px] border-r border-b border-border bg-white p-2 text-left align-top transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9297a0]/45 sm:min-h-[124px]',
                !inMonth && 'bg-[#fafafa] text-muted-foreground/50',
                selected && 'bg-[#f5e9d4]/45 ring-2 ring-inset ring-[#181d26]',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-medium text-[#181d26]',
                    !inMonth && 'text-muted-foreground/50',
                    today && 'bg-[#181d26] text-white',
                  )}
                >
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="rounded-full bg-[#181d26] px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    className={cn('truncate rounded-md border px-2 py-1 text-xs font-medium leading-4', getCalendarEventClass(event))}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && <div className="px-2 text-xs font-medium text-muted-foreground">+{dayEvents.length - 2} 更多</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CalendarEventRow({ event, onOpenTask }: { event: CalendarEvent; onOpenTask?: () => void }) {
  const content = (
    <>
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border', getCalendarEventIconClass(event))}>
        <CalendarClock className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[#181d26]">{event.title}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatDateTime(event.start_at)}</span>
          {event.is_recurring && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">重复</Badge>}
          {event.type === 'projected_occurrence' && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">预计</Badge>}
          <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', getCalendarStatusClass(event.status))}>
            {formatEventStatus(event.status)}
          </Badge>
        </div>
      </div>
    </>
  )

  if (onOpenTask) {
    return (
      <button type="button" onClick={onOpenTask} className="flex w-full items-start gap-3 rounded-md border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/40">
        {content}
      </button>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-3">
      {content}
    </div>
  )
}

function getCalendarEventClass(event: CalendarEvent) {
  if (event.is_recurring) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  }
  if (event.type === 'projected_occurrence') {
    return 'border-[#458fff]/30 bg-[#458fff]/10 text-[#254fad]'
  }
  switch (event.status) {
  case 'done':
    return 'border-green-200 bg-green-50 text-green-900'
  case 'failed':
    return 'border-red-200 bg-red-50 text-red-900'
  case 'blocked':
    return 'border-amber-200 bg-amber-50 text-amber-900'
  default:
    return 'border-[#dddddd] bg-[#f8fafc] text-[#181d26]'
  }
}

function getCalendarEventIconClass(event: CalendarEvent) {
  if (event.is_recurring) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (event.type === 'projected_occurrence') return 'border-[#458fff]/30 bg-[#458fff]/10 text-[#254fad]'
  if (event.status === 'done') return 'border-green-200 bg-green-50 text-green-800'
  if (event.status === 'failed') return 'border-red-200 bg-red-50 text-red-800'
  if (event.status === 'blocked') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-[#dddddd] bg-[#f8fafc] text-[#41454d]'
}

function getCalendarStatusClass(status: string) {
  switch (status) {
  case 'done':
    return 'border-green-200 bg-green-50 text-green-800'
  case 'failed':
    return 'border-red-200 bg-red-50 text-red-800'
  case 'blocked':
    return 'border-amber-200 bg-amber-50 text-amber-800'
  case 'in_progress':
    return 'border-[#458fff]/30 bg-[#458fff]/10 text-[#254fad]'
  default:
    return 'border-[#dddddd] bg-[#f8fafc] text-[#41454d]'
  }
}

function formatEventStatus(status: string) {
  switch (status) {
  case 'pending':
    return '待处理'
  case 'in_progress':
    return '进行中'
  case 'done':
    return '已完成'
  case 'failed':
    return '失败'
  case 'blocked':
    return '阻塞'
  default:
    return status || '未开始'
  }
}

function getCalendarRange(month: Date) {
  const first = startOfMonth(month)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const gridStart = startOfDay(new Date(first))
  gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  const gridEnd = startOfDay(new Date(last))
  gridEnd.setDate(last.getDate() + (7 - ((last.getDay() + 6) % 7)))

  const days: Date[] = []
  for (const cursor = new Date(gridStart); cursor < gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor))
  }
  return { gridStart, gridEnd, days }
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDayTitle(value: Date) {
  return value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
}

function formatMonthTitle(value: Date) {
  return value.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
}

function formatDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
