import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Hash, PauseCircle, PlayCircle, Repeat2, Trash2 } from 'lucide-react'
import { useTasks } from '../../hooks/use-tasks.js'
import { useChannels } from '../../hooks/use-channels.js'
import type { CalendarEvent, ChannelMemberInfo, Task } from '../../core/types.js'
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
    projects, tasks, scheduledTasks, calendarEvents, loading, schedulesLoading,
    getTask, createTask, createScheduledTask, updateScheduledTask, deleteScheduledTask, deleteTask, fetchScheduledTasks, fetchCalendar,
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">当前对话任务</h2>
          <ChannelSwitcher channels={channels} currentChannelId={channelId} onSelect={joinChannel} />
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">选择一个频道查看任务</div>
      </div>
    )
  }

  const groupedByProject = projects.map((proj) => ({
    project: proj,
    tasks: tasks.filter((t) => t.project_id === proj.id),
  })).filter(({ tasks: pTasks }) => pTasks.length > 0)
  const orphanTasks = tasks.filter((t) => !t.project_id)
  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) || null : null
  const selectedEvents = calendarEvents.filter((event) => isSameLocalDay(new Date(event.start_at), selectedDate))
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
  }
  const handleCreateScheduledTask = async (data: Parameters<typeof createScheduledTask>[0]) => {
    const created = await createScheduledTask(data)
    if (created) {
      setActiveTab('schedules')
      await fetchScheduledTasks()
      await refreshCalendarRange()
    }
  }
  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    await updateScheduledTask(scheduleId, { enabled })
    await fetchScheduledTasks()
    await refreshCalendarRange()
  }
  const handleDeleteSchedule = async (scheduleId: string) => {
    await deleteScheduledTask(scheduleId)
    await refreshCalendarRange()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">当前对话任务</h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Hash className="w-3 h-3" />
            <span className="truncate">{currentChannel?.name || '未命名频道'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ChannelSwitcher channels={channels} currentChannelId={channelId} onSelect={joinChannel} />
          <CreateScheduledTaskDialog agents={agentMembers} onSubmit={handleCreateScheduledTask} />
          <CreateTaskDialog agents={agentMembers} onSubmit={handleCreateTask} requestOpenKey={createTaskRequest} />
        </div>
      </div>
      <Tabs defaultValue="tasks" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <TabsList className="w-full">
            <TabsTrigger value="tasks" className="flex-1 gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />任务清单</TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1 gap-1.5"><CalendarClock className="w-3.5 h-3.5" />日历</TabsTrigger>
            <TabsTrigger value="schedules" className="flex-1 gap-1.5"><Repeat2 className="w-3.5 h-3.5" />自动任务</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="flex-1 overflow-y-auto px-2 py-2">
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

        <TabsContent value="calendar" className="flex-1 overflow-y-auto px-3 py-3">
          <CalendarMonth
            month={calendarMonth}
            selectedDate={selectedDate}
            events={calendarEvents}
            onSelectDate={setSelectedDate}
            onPreviousMonth={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
            onNextMonth={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
          />
          <div className="mt-3 border-t border-border pt-2">
            <div className="px-1 py-1 text-xs font-medium text-muted-foreground">{formatDayTitle(selectedDate)}</div>
            {selectedEvents.length === 0 ? (
              <div className="px-1 py-3 text-sm text-muted-foreground">当天无任务</div>
            ) : (
              <div className="space-y-1">
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

        <TabsContent value="schedules" className="flex-1 overflow-y-auto px-2 py-2">
          {schedulesLoading ? (
            <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
          ) : scheduledTasks.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">暂无自动任务</div>
          ) : (
            <div className="space-y-1">
              {scheduledTasks.map((schedule) => (
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
        onTaskChanged={refreshCalendarRange}
      />
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

function CalendarMonth({
  month,
  selectedDate,
  events,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
}: {
  month: Date
  selectedDate: Date
  events: CalendarEvent[]
  onSelectDate: (date: Date) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
}) {
  const range = getCalendarRange(month)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button size="icon-sm" variant="ghost" title="上个月" onClick={onPreviousMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-sm font-medium">{month.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}</div>
        <Button size="icon-sm" variant="ghost" title="下个月" onClick={onNextMonth}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 border-l border-t border-border">
        {WEEKDAYS.map((day) => (
          <div key={day} className="border-r border-b border-border bg-muted/40 py-1 text-center text-[10px] font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        {range.days.map((date) => {
          const dayEvents = events.filter((event) => isSameLocalDay(new Date(event.start_at), date))
          const inMonth = date.getMonth() === month.getMonth()
          const selected = isSameLocalDay(date, selectedDate)
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelectDate(date)}
              className={cn(
                'min-h-[76px] border-r border-b border-border p-1 text-left align-top transition-colors hover:bg-muted/40',
                !inMonth && 'bg-muted/20 text-muted-foreground/50',
                selected && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn('text-[11px]', isSameLocalDay(date, new Date()) && 'font-semibold text-primary')}>{date.getDate()}</span>
                {dayEvents.length > 0 && <span className="size-1.5 rounded-full bg-primary" />}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      'truncate rounded-sm px-1 py-0.5 text-[10px] leading-3',
                      event.is_recurring ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground',
                    )}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</div>}
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
      <CalendarClock className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{event.title}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{formatDateTime(event.start_at)}</span>
          {event.is_recurring && <Badge variant="outline" className="text-[10px] px-1.5 py-0">重复</Badge>}
          {event.type === 'projected_occurrence' && <Badge variant="outline" className="text-[10px] px-1.5 py-0">预计</Badge>}
        </div>
      </div>
    </>
  )

  if (onOpenTask) {
    return (
      <button type="button" onClick={onOpenTask} className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50">
        {content}
      </button>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-muted/50">
      {content}
    </div>
  )
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

function formatDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
