import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, FileText, FolderOpen, ListChecks, Maximize2, MessageSquareQuote, PauseCircle, Repeat2, Save, Search, Upload, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CalendarEvent, ChannelMemberInfo, Task, StorageObject } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { formatBytes, formatTime } from '../../lib/format.js'
import { storageDisplayName } from '../../lib/storage-display.js'
import { storageRefFromKey } from '../../lib/storage-ref.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { useStorage } from '../../hooks/use-storage.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useTasks } from '../../hooks/use-tasks.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'
import { Button } from '../ui/button.js'
import { Badge } from '../ui/badge.js'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog.js'
import { Input } from '../ui/input.js'
import { CloudStoragePanel } from '../storage/CloudStoragePanel.js'
import { CreateScheduledTaskDialog } from '../tasks/CreateScheduledTaskDialog.js'
import { CreateTaskDialog } from '../tasks/CreateTaskDialog.js'
import { TaskDetailSheet } from '../tasks/TaskDetailSheet.js'

interface Props {
  channelId: string | null
  members?: ChannelMemberInfo[]
  tasks?: Task[]
  files?: StorageObject[]
  onCreateTask?: () => void
  onMembersChanged?: () => void
  className?: string
}

interface AgentIdentityForm {
  name: string
  personality: string
  content: string
}

export function DetailPanel({ channelId, members = [], tasks = [], files = [], onCreateTask, onMembersChanged, className }: Props) {
  const { api } = useBeeSeedContext()
  const { user } = useAuth()
  const { panelVisible, insertIntoComposer, setActiveFeature } = useDetailPanel()
  const {
    tasks: storeTasks,
    scheduledTasks,
    calendarEvents,
    createTask,
    createScheduledTask,
    fetchScheduledTasks,
    fetchCalendar,
  } = useTasks(channelId)
  const { objects: storageObjects, uploadFile } = useStorage(channelId)
  const [tasksOpen, setTasksOpen] = useState(true)
  const [taskView, setTaskView] = useState<'focus' | 'calendar' | 'schedules'>('focus')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [filesOpen, setFilesOpen] = useState(true)
  const [membersOpen, setMembersOpen] = useState(true)
  const [storageOpen, setStorageOpen] = useState(false)
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<ChannelMemberInfo | null>(null)
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentityForm>({ name: '', personality: '', content: '' })
  const [agentSettingsLoading, setAgentSettingsLoading] = useState(false)
  const [agentSettingsSaving, setAgentSettingsSaving] = useState(false)

  const agents = members.filter((m) => m.member_type === 'agent')
  const users = members.filter((m) => m.member_type === 'user')
  const channelTasks = storeTasks.length > 0 ? storeTasks : tasks
  const channelFiles = storageObjects.length > 0 ? storageObjects : files
  const currentMember = user ? users.find((m) => m.user_id === user.id) : null
  const canEditAgents = currentMember?.role === 'owner' || currentMember?.role === 'coordinator'
  const agentNames = new Map(agents.map((agent) => [agent.agent_id, agent.display_name || agent.agent_id || 'Agent']))
  const selectedTask = selectedTaskId ? channelTasks.find((task) => task.id === selectedTaskId) || null : null
  const now = Date.now()
  const activeTasks = useMemo(() => channelTasks.filter((task) => task.status !== 'done' && task.status !== 'failed'), [channelTasks])
  const focusTasks = useMemo(() => [...activeTasks].sort(compareTasksForFocus).slice(0, 6), [activeTasks])
  const upcomingEvents = useMemo(() => [...calendarEvents]
    .filter((event) => new Date(event.start_at).getTime() >= now - 60_000)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 6), [calendarEvents, now])
  const visibleSchedules = useMemo(() => [...scheduledTasks]
    .sort((a, b) => eventTimeValue(a.next_fire_at || a.run_at) - eventTimeValue(b.next_fire_at || b.run_at))
    .slice(0, 6), [scheduledTasks])
  const runningCount = channelTasks.filter((task) => task.status === 'in_progress').length
  const blockedCount = channelTasks.filter((task) => task.status === 'blocked' || task.scheduler_state === 'pending_deps').length
  const doneCount = channelTasks.filter((task) => task.status === 'done').length

  if (!panelVisible || !channelId) return null

  function referenceFile(file: StorageObject) {
    insertIntoComposer(storageRefFromKey(file.key))
  }

  async function uploadFromPicker(file: File | undefined) {
    if (!file) return
    await uploadFile(file)
  }

  async function handleCreateTask(data: Parameters<typeof createTask>[0]) {
    const task = await createTask(data)
    if (task?.due_at || task?.scheduled_start_at) {
      await fetchCalendar()
    }
  }

  async function handleCreateScheduledTask(data: Parameters<typeof createScheduledTask>[0]) {
    const created = await createScheduledTask(data)
    if (created) {
      setTaskView('schedules')
      await fetchScheduledTasks()
      await fetchCalendar()
    }
  }

  function openTaskCenter() {
    setActiveFeature('tasks')
  }

  function openCalendarEvent(event: CalendarEvent) {
    if (event.task_id) {
      setSelectedTaskId(event.task_id)
      return
    }
    openTaskCenter()
  }

  async function openAgentSettings(member: ChannelMemberInfo) {
    if (!member.agent_id || !canEditAgents) return
    setSelectedAgent(member)
    setAgentSettingsOpen(true)
    setAgentSettingsLoading(true)
    try {
      const identity = await api.get(`channels/${channelId}/agents/${member.agent_id}/identity`).json<AgentIdentityForm>()
      setAgentIdentity({
        name: identity.name || member.display_name || member.agent_id,
        personality: identity.personality || '',
        content: identity.content || '',
      })
    } catch {
      setAgentIdentity({ name: member.display_name || member.agent_id, personality: '', content: '' })
    } finally {
      setAgentSettingsLoading(false)
    }
  }

  async function saveAgentSettings() {
    if (!selectedAgent?.agent_id) return
    setAgentSettingsSaving(true)
    try {
      await api.put(`channels/${channelId}/agents/${selectedAgent.agent_id}/identity`, { json: agentIdentity })
      onMembersChanged?.()
      setAgentSettingsOpen(false)
    } finally {
      setAgentSettingsSaving(false)
    }
  }

  return (
    <div className={cn('w-[300px] shrink-0 border-l border-border bg-background flex flex-col overflow-hidden', className)}>
      <div className="flex-1 overflow-y-auto">
        {/* Tasks */}
        <div className="border-b border-border">
          <div className="flex items-center gap-1 px-4 py-3 hover:bg-muted/30 transition-colors">
            <button onClick={() => setTasksOpen(!tasksOpen)} className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
              <ListChecks className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-left">任务</span>
              {activeTasks.length > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-primary-foreground">
                  {activeTasks.length > 99 ? '99' : activeTasks.length}
                </span>
              )}
              {tasksOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            <CreateScheduledTaskDialog agents={agents} onSubmit={handleCreateScheduledTask} />
            <CreateTaskDialog agents={agents} onSubmit={handleCreateTask} />
            <button
              title="打开任务中心"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={openTaskCenter}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {tasksOpen && (
            <div className="px-4 pb-3 space-y-3">
              <div className="grid grid-cols-3 gap-1.5">
                <TaskStat label="进行" value={runningCount} />
                <TaskStat label="阻塞" value={blockedCount} tone={blockedCount > 0 ? 'warn' : 'muted'} />
                <TaskStat label="完成" value={doneCount} tone="success" />
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                <TaskViewButton active={taskView === 'focus'} onClick={() => setTaskView('focus')}>焦点</TaskViewButton>
                <TaskViewButton active={taskView === 'calendar'} onClick={() => setTaskView('calendar')}>日程</TaskViewButton>
                <TaskViewButton active={taskView === 'schedules'} onClick={() => setTaskView('schedules')}>自动</TaskViewButton>
              </div>
              {taskView === 'focus' && (
                focusTasks.length === 0 ? (
                  <EmptyTaskState label="暂无待处理任务" />
                ) : (
                  <div className="space-y-1.5">
                    {focusTasks.map((task) => (
                      <CompactTaskRow
                        key={task.id}
                        task={task}
                        assignedLabel={task.assigned_agent_id ? agentNames.get(task.assigned_agent_id) : undefined}
                        onClick={() => setSelectedTaskId(task.id)}
                      />
                    ))}
                  </div>
                )
              )}
              {taskView === 'calendar' && (
                upcomingEvents.length === 0 ? (
                  <EmptyTaskState label="近期无日程" />
                ) : (
                  <div className="space-y-1.5">
                    {upcomingEvents.map((event) => (
                      <CompactCalendarRow key={event.id} event={event} onClick={() => openCalendarEvent(event)} />
                    ))}
                  </div>
                )
              )}
              {taskView === 'schedules' && (
                visibleSchedules.length === 0 ? (
                  <EmptyTaskState label="暂无自动任务" />
                ) : (
                  <div className="space-y-1.5">
                    {visibleSchedules.map((schedule) => (
                      <button key={schedule.id} type="button" onClick={openTaskCenter} className="w-full rounded-md border border-border bg-background px-2 py-2 text-left hover:bg-muted/40 transition-colors">
                        <div className="flex items-start gap-2">
                          <Repeat2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium">{schedule.template_title || schedule.recurrence_rule || formatShortDateTime(schedule.run_at)}</div>
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>{schedule.kind === 'recurring' ? '重复' : '一次'}</span>
                              {(schedule.next_fire_at || schedule.run_at) && <span>{formatShortDateTime(schedule.next_fire_at || schedule.run_at)}</span>}
                              {schedule.assigned_agent_id && <span className="truncate">@{agentNames.get(schedule.assigned_agent_id) || schedule.assigned_agent_id}</span>}
                            </div>
                          </div>
                          {schedule.enabled ? (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">启用</Badge>
                          ) : (
                            <PauseCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
              {onCreateTask && (
                <button onClick={onCreateTask} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  进入完整创建流程
                </button>
              )}
            </div>
          )}
        </div>

        {/* Files */}
        <div className="border-b border-border">
          <div className="flex items-center gap-1 px-4 py-3 hover:bg-muted/30 transition-colors">
            <button onClick={() => setFilesOpen(!filesOpen)} className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-left">云存储</span>
              {filesOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            <button
              title="打开云存储"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={() => setStorageOpen(true)}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {filesOpen && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-primary">云存储</span>
                <span className="text-[10px] text-muted-foreground">/</span>
                <span className="text-[10px] text-muted-foreground">当前对话</span>
                <div className="flex-1" />
                <Search className="w-3 h-3 text-muted-foreground" />
                <label className="cursor-pointer">
                  <Upload className="w-3 h-3 text-muted-foreground" />
                  <input type="file" className="hidden" onChange={(e) => { void uploadFromPicker(e.target.files?.[0]); e.target.value = '' }} />
                </label>
              </div>
              {channelFiles.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 py-2">暂无文件</div>
              ) : (
                <div className="space-y-1.5">
                  {channelFiles.slice(0, 5).map((f) => (
                    <div key={f.key} className="group flex items-start gap-2 py-1 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
                      <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate">{storageDisplayName(f)}</div>
                        <div className="text-[10px] text-muted-foreground">{formatBytes(f.size)} · {formatTime(f.last_modified)}</div>
                      </div>
                      <button
                        title="引用到聊天"
                        className="hidden rounded p-1 text-muted-foreground hover:bg-muted group-hover:block"
                        onClick={() => referenceFile(f)}
                      >
                        <MessageSquareQuote className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div>
          <button onClick={() => setMembersOpen(!membersOpen)} className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-left">成员</span>
            {membersOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {membersOpen && (
            <div className="px-4 pb-3">
              {agents.length > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">AGENT — {agents.length}</div>
                  <div className="space-y-2 mb-3">
                    {agents.map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5">
                        <button
                          type="button"
                          title={canEditAgents ? '设置 Agent' : undefined}
                          onClick={() => { void openAgentSettings(m) }}
                          className={cn('rounded-full', canEditAgents && 'hover:ring-2 hover:ring-foreground/15')}
                          disabled={!canEditAgents}
                        >
                          <Avatar className="size-7 shrink-0">
                            {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                            <AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700">AI</AvatarFallback>
                          </Avatar>
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{m.display_name}</div>
                          {m.chinese_name && m.chinese_name !== m.display_name && (
                            <div className="text-[10px] text-muted-foreground">{m.chinese_name}</div>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">{m.role}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {users.length > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">用户 — {users.length}</div>
                  <div className="space-y-2">
                    {users.map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5">
                        <Avatar className="size-7 shrink-0">
                          {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                          <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">{m.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{m.display_name}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">{m.role === 'owner' ? '拥有者' : m.role}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {members.length === 0 && <div className="text-xs text-muted-foreground/60 py-2">暂无成员数据</div>}
            </div>
          )}
        </div>
      </div>

      <Dialog open={storageOpen} onOpenChange={setStorageOpen}>
        <DialogContent
          className="h-[min(720px,calc(100vh-4rem))] w-[min(920px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] sm:max-w-[920px] overflow-hidden p-0"
          onClose={() => setStorageOpen(false)}
        >
          <CloudStoragePanel channelId={channelId} className="h-full" onReference={() => setStorageOpen(false)} />
        </DialogContent>
      </Dialog>

      <TaskDetailSheet
        channelId={channelId}
        task={selectedTask}
        members={members}
        open={!!selectedTask}
        onClose={() => setSelectedTaskId(null)}
        onTaskChanged={fetchCalendar}
      />

      <Dialog open={agentSettingsOpen} onOpenChange={setAgentSettingsOpen}>
        <DialogContent className="w-[min(420px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0" onClose={() => setAgentSettingsOpen(false)}>
          <div className="p-4">
            <DialogHeader>
              <DialogTitle>Agent 设置</DialogTitle>
            </DialogHeader>
            {agentSettingsLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">名称</label>
                  <Input
                    value={agentIdentity.name}
                    onChange={(e) => setAgentIdentity({ ...agentIdentity, name: e.target.value })}
                    placeholder={selectedAgent?.agent_id || 'Agent'}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">性格特点</label>
                  <textarea
                    value={agentIdentity.personality}
                    onChange={(e) => setAgentIdentity({ ...agentIdentity, personality: e.target.value })}
                    placeholder="例如：主动、简洁、偏产品视角"
                    className="min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAgentSettingsOpen(false)}>取消</Button>
            <Button onClick={saveAgentSettings} disabled={agentSettingsLoading || agentSettingsSaving || !selectedAgent?.agent_id}>
              <Save className="w-4 h-4" />
              {agentSettingsSaving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskStat({ label, value, tone = 'muted' }: { label: string; value: number; tone?: 'muted' | 'warn' | 'success' }) {
  return (
    <div
      className={cn(
        'rounded-md border px-2 py-1.5',
        tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-900',
        tone === 'success' && 'border-green-200 bg-green-50 text-green-900',
        tone === 'muted' && 'border-border bg-muted/20 text-foreground',
      )}
    >
      <div className="text-[10px] leading-none text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium leading-none">{value}</div>
    </div>
  )
}

function TaskViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded px-2 py-1 text-xs transition-colors',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function EmptyTaskState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
      {label}
    </div>
  )
}

const TASK_STATUS_META: Record<Task['status'], { label: string; icon: typeof Circle; badge: 'outline' | 'default' | 'success' | 'destructive' | 'warning' }> = {
  pending: { label: '待处理', icon: Circle, badge: 'outline' },
  in_progress: { label: '进行中', icon: Clock, badge: 'default' },
  done: { label: '已完成', icon: CheckCircle2, badge: 'success' },
  failed: { label: '失败', icon: AlertTriangle, badge: 'destructive' },
  blocked: { label: '阻塞', icon: AlertTriangle, badge: 'warning' },
}

function CompactTaskRow({ task, assignedLabel, onClick }: { task: Task; assignedLabel?: string; onClick: () => void }) {
  const meta = TASK_STATUS_META[task.status]
  const StatusIcon = meta.icon
  const dependencyCount = task.depends_on_task_ids?.length || 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-border bg-background px-2 py-2 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start gap-2">
        <StatusIcon className={cn(
          'mt-0.5 h-3.5 w-3.5 shrink-0',
          task.status === 'done' && 'text-green-600',
          task.status === 'failed' && 'text-red-500',
          task.status === 'blocked' && 'text-amber-500',
          task.status === 'in_progress' && 'text-blue-500',
          task.status === 'pending' && 'text-muted-foreground',
        )} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{task.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-muted-foreground">
            <Badge variant={meta.badge} className="px-1.5 py-0 text-[10px] font-medium">
              {meta.label}
            </Badge>
            {task.scheduler_state === 'pending_deps' && <span>等待依赖</span>}
            {dependencyCount > 0 && <span>依赖 {dependencyCount}</span>}
            {task.due_at && <span>{formatShortDateTime(task.due_at)}</span>}
            {assignedLabel && <span className="max-w-[120px] truncate">@{assignedLabel}</span>}
          </div>
        </div>
      </div>
    </button>
  )
}

function CompactCalendarRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-border bg-background px-2 py-2 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start gap-2">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{event.title}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{formatShortDateTime(event.start_at)}</span>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
              {event.type === 'projected_occurrence' ? '预览' : formatEventStatus(event.status)}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  )
}

function compareTasksForFocus(a: Task, b: Task) {
  const score = (task: Task) => {
    if (task.status === 'blocked') return 0
    if (task.scheduler_state === 'pending_deps') return 1
    if (task.status === 'in_progress' || task.scheduler_state === 'dispatched') return 2
    if (task.scheduler_state === 'ready') return 3
    if (task.status === 'pending') return 4
    return 5
  }

  return (
    score(a) - score(b) ||
    (b.priority || 0) - (a.priority || 0) ||
    eventTimeValue(a.due_at) - eventTimeValue(b.due_at) ||
    eventTimeValue(a.created_at) - eventTimeValue(b.created_at)
  )
}

function eventTimeValue(value?: string) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
}

function formatShortDateTime(value?: string) {
  if (!value) return '未设置'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间无效'
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatEventStatus(status: string) {
  if (status === 'done') return '完成'
  if (status === 'failed') return '失败'
  if (status === 'blocked') return '阻塞'
  if (status === 'in_progress') return '进行中'
  return '任务'
}
