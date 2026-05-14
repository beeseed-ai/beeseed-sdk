import { CalendarClock, CheckCircle2, Clock3, PauseCircle, PlayCircle, Repeat2, Trash2 } from 'lucide-react'
import { useTasks } from '../../hooks/use-tasks.js'
import { TaskItem } from './TaskItem.js'
import { CreateTaskDialog } from './CreateTaskDialog.js'
import { CreateScheduledTaskDialog } from './CreateScheduledTaskDialog.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'

interface Props {
  roomId: string | null
}

export function TaskPanel({ roomId }: Props) {
  const {
    projects, tasks, scheduledTasks, calendarEvents, loading,
    createTask, createScheduledTask, updateScheduledTask, deleteScheduledTask,
  } = useTasks(roomId)

  if (!roomId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">选择一个对话查看任务</div>
  }

  const groupedByProject = projects.map((proj) => ({
    project: proj,
    tasks: tasks.filter((t) => t.project_id === proj.id),
  }))
  const orphanTasks = tasks.filter((t) => !t.project_id)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">任务</h2>
        <div className="flex items-center gap-1">
          <CreateScheduledTaskDialog onSubmit={(data) => createScheduledTask(data)} />
          <CreateTaskDialog onSubmit={(data) => createTask(data)} />
        </div>
      </div>
      <Tabs defaultValue="tasks" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <TabsList className="w-full">
            <TabsTrigger value="tasks" className="flex-1 gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />任务</TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1 gap-1.5"><CalendarClock className="w-3.5 h-3.5" />日历</TabsTrigger>
            <TabsTrigger value="schedules" className="flex-1 gap-1.5"><Repeat2 className="w-3.5 h-3.5" />计划</TabsTrigger>
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
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              ))}
              {orphanTasks.length > 0 && (
                <div className="mb-3">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">未分组</div>
                  {orphanTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="calendar" className="flex-1 overflow-y-auto px-2 py-2">
          {calendarEvents.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">暂无日历任务</div>
          ) : (
            <div className="space-y-1">
              {calendarEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-muted/50">
                  <Clock3 className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{event.title}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(event.start_at)}</span>
                      {event.is_recurring && <Badge variant="outline" className="text-[10px] px-1.5 py-0">重复</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="schedules" className="flex-1 overflow-y-auto px-2 py-2">
          {scheduledTasks.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">暂无计划</div>
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
                        onClick={() => updateScheduledTask(schedule.id, { enabled: !schedule.enabled })}
                      >
                        {schedule.enabled ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="删除"
                        onClick={() => deleteScheduledTask(schedule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function formatDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
