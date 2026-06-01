import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, FileText, FolderOpen, ListChecks, Maximize2, MessageSquareQuote, Monitor, PauseCircle, Plus, Repeat2, Save, Search, Trash2, Upload, Users, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CalendarEvent, ChannelMemberInfo, ModelTierName, Task, StorageObject } from '../../core/types.js'
import type { CreateScheduledTaskInput } from '../../stores/tasks.js'
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
import { StoragePreviewDialog } from '../chat/StorageAttachmentPreview.js'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog.js'
import { Input } from '../ui/input.js'
import { CloudStoragePanel } from '../storage/CloudStoragePanel.js'
import { CreateScheduledTaskDialog } from '../tasks/CreateScheduledTaskDialog.js'
import { CreateTaskDialog } from '../tasks/CreateTaskDialog.js'
import { TaskDetailSheet } from '../tasks/TaskDetailSheet.js'
import { SkillIcon } from '../skills/SkillIcon.js'

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

interface AgentConfigForm {
  role?: string
  provider?: string
  model?: string
  model_tier?: ModelTierName | ''
  temperature?: number
  thinking?: boolean
  tools?: string[]
  skills?: string[]
  avatar_preset?: string
  identity?: Partial<AgentIdentityForm>
  [key: string]: unknown
}

interface SkillSummary {
  name: string
  display_name?: string
  icon_url?: string
  category?: string
  description?: string
  triggers?: string[]
}

interface AgentTemplateSummary {
  id: string
  name: string
  role?: string
  version?: string
  avatar_url?: string
  avatar_preset?: string
}

interface LocalAgentDevice {
  device_id?: string
  id?: string
  status?: string
  last_seen_at?: string
  connected_at?: string
  revoked_at?: string | null
}

interface LocalAgentGrant {
  grant_id?: string
  permissions?: string[]
  revoked_at?: string | null
}

interface LocalAgentSummary {
  loading: boolean
  totalDevices: number
  onlineDevices: number
  grants: number
  writableGrants: number
  error: string
}

interface LocalAgentDevicesResponse {
  devices?: LocalAgentDevice[]
}

interface LocalAgentGrantsResponse {
  grants?: LocalAgentGrant[]
}

const LOCAL_AGENT_ID = 'local-agent'
const MODEL_TIER_OPTIONS: { value: ModelTierName; label: string }[] = [
  { value: 'fast', label: '快速' },
  { value: 'thinking', label: '思考' },
  { value: 'pro', label: '专业' },
]
const AVATAR_PRESETS = [
  'bot-amber',
  'bot-blue',
  'bot-emerald',
  'bot-rose',
  'bot-violet',
  'owl',
  'rocket',
  'star',
  'leaf',
  'lightning',
]

function normalizeModelTier(value: unknown): ModelTierName | '' {
  return value === 'fast' || value === 'thinking' || value === 'pro' ? value : ''
}

function avatarPresetUrl(preset: string | undefined) {
  return preset ? `/avatars/agents/${preset}.svg` : ''
}

function directoryDisplayName(dir: string) {
  return dir.replace(/\/$/, '').split('/').pop() || dir
}

function parseInviteEmails(value: string) {
  return Array.from(new Set(
    value
      .split(/[\s,;，；]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ))
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return objectValue(parsed)
    } catch {
      return {}
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function isLocalAgentMember(member: ChannelMemberInfo) {
  const extInfo = objectValue(member.ext_info)
  return member.member_type === 'agent' && (
    member.agent_id === LOCAL_AGENT_ID ||
    extInfo.agent_kind === 'local_agent' ||
    extInfo.runtime === 'local_agent'
  )
}

function localAgentDateValue(value: string | null | undefined) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function localAgentDeviceOnline(device: LocalAgentDevice) {
  if (device.revoked_at) return false
  const status = (device.status || '').toLowerCase()
  if (status === 'offline' || status === 'revoked' || status === 'stopped') return false
  if (status === 'ok' || status === 'ready' || status === 'degraded' || status === 'running') return true
  const lastSeen = localAgentDateValue(device.last_seen_at || device.connected_at)
  return lastSeen > 0 && Date.now() - lastSeen < 2 * 60 * 1000
}

function localAgentGrantCanWrite(grant: LocalAgentGrant) {
  const permissions = grant.permissions ?? []
  return permissions.includes('write') || permissions.includes('read_write')
}

const emptyLocalAgentSummary: LocalAgentSummary = {
  loading: false,
  totalDevices: 0,
  onlineDevices: 0,
  grants: 0,
  writableGrants: 0,
  error: '',
}

function localAgentStatusText(summary: LocalAgentSummary) {
  if (summary.loading) return '正在同步状态'
  if (summary.error) return '状态暂不可用'
  if (summary.totalDevices === 0) return '暂无已绑定设备'
  if (summary.onlineDevices > 0) {
    return `${summary.onlineDevices} 台在线 · ${summary.writableGrants} 个可写授权`
  }
  if (summary.grants > 0) return `设备离线 · ${summary.grants} 个目录授权`
  return '设备离线'
}

export function DetailPanel({ channelId, members = [], tasks = [], files = [], onCreateTask, onMembersChanged, className }: Props) {
  const { api, channelsStore } = useBeeSeedContext()
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
  const {
    objects: storageObjects,
    directories: storageDirectories,
    breadcrumbs: storageBreadcrumbs,
    browse: browseStorage,
    uploadFile,
  } = useStorage(channelId)
  const [tasksOpen, setTasksOpen] = useState(true)
  const [taskView, setTaskView] = useState<'focus' | 'calendar' | 'schedules'>('focus')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [filesOpen, setFilesOpen] = useState(true)
  const [storagePreviewRef, setStoragePreviewRef] = useState<string | null>(null)
  const [membersOpen, setMembersOpen] = useState(true)
  const [userInviteOpen, setUserInviteOpen] = useState(false)
  const [inviteEmails, setInviteEmails] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [storageOpen, setStorageOpen] = useState(false)
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<ChannelMemberInfo | null>(null)
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentityForm>({ name: '', personality: '', content: '' })
  const [agentConfig, setAgentConfig] = useState<AgentConfigForm | null>(null)
  const [skillModalOpen, setSkillModalOpen] = useState(false)
  const [availableSkills, setAvailableSkills] = useState<SkillSummary[]>([])
  const [skillQuery, setSkillQuery] = useState('')
  const [agentPickerOpen, setAgentPickerOpen] = useState(false)
  const [availableAgents, setAvailableAgents] = useState<AgentTemplateSummary[]>([])
  const [agentQuery, setAgentQuery] = useState('')
  const [agentActionLoading, setAgentActionLoading] = useState('')
  const [agentActionError, setAgentActionError] = useState('')
  const [agentSettingsLoading, setAgentSettingsLoading] = useState(false)
  const [agentSettingsSaving, setAgentSettingsSaving] = useState(false)

  const agentMembers = members.filter((m) => m.member_type === 'agent')
  const localAgents = agentMembers.filter(isLocalAgentMember)
  const cloudAgents = agentMembers.filter((m) => !isLocalAgentMember(m))
  const users = members.filter((m) => m.member_type === 'user')
  const channelTasks = storeTasks.length > 0 ? storeTasks : tasks
  const channelFiles = storageObjects.length > 0 || storageDirectories.length > 0 ? storageObjects : files
  const currentMember = user ? users.find((m) => m.user_id === user.id) : null
  const canEditAgents = currentMember?.role === 'owner' || currentMember?.role === 'coordinator'
  const canManageAgentMembers = currentMember?.role === 'owner'
  const canInviteUsers = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const canConfigureAgentTier = Boolean(currentMember)
  const agentNames = new Map(agentMembers.map((agent) => [agent.agent_id, agent.display_name || agent.agent_id || 'Agent']))
  const channelAgentIDs = useMemo(() => new Set(agentMembers.map((agent) => agent.agent_id).filter(Boolean) as string[]), [agentMembers])
  const [localAgentSummary, setLocalAgentSummary] = useState<LocalAgentSummary>(emptyLocalAgentSummary)
  const filteredAvailableAgents = useMemo(() => availableAgents
    .filter((agent) => !channelAgentIDs.has(agent.id))
    .filter((agent) => {
      const query = agentQuery.trim().toLowerCase()
      if (!query) return true
      return [agent.id, agent.name, agent.role, agent.version].some((value) => (value ?? '').toLowerCase().includes(query))
    }), [agentQuery, availableAgents, channelAgentIDs])
  const selectedTask = selectedTaskId ? channelTasks.find((task) => task.id === selectedTaskId) || null : null
  const now = Date.now()
  const activeTasks = useMemo(() => channelTasks.filter((task) => task.status !== 'done' && task.status !== 'failed'), [channelTasks])
  const focusTaskItems = useMemo(() => activeTasks
    .filter((task) => isFocusableTask(task, now))
    .sort(compareTasksForFocus), [activeTasks, now])
  const focusTasks = useMemo(() => focusTaskItems.slice(0, 6), [focusTaskItems])
  const upcomingEventItems = useMemo(() => [...calendarEvents]
    .filter((event) => !event.is_recurring && new Date(event.start_at).getTime() >= now - 60_000)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()), [calendarEvents, now])
  const upcomingEvents = useMemo(() => upcomingEventItems.slice(0, 6), [upcomingEventItems])
  const recurringScheduleItems = useMemo(() => [...scheduledTasks]
    .filter((schedule) => schedule.kind === 'recurring')
    .sort((a, b) => eventTimeValue(a.next_fire_at || a.run_at) - eventTimeValue(b.next_fire_at || b.run_at)), [scheduledTasks])
  const visibleSchedules = useMemo(() => recurringScheduleItems.slice(0, 6), [recurringScheduleItems])
  const runningCount = channelTasks.filter((task) => task.status === 'in_progress').length
  const blockedCount = channelTasks.filter((task) => task.status === 'blocked' || task.scheduler_state === 'pending_deps').length
  const doneCount = channelTasks.filter((task) => task.status === 'done').length

  useEffect(() => {
    if (!channelId || localAgents.length === 0) {
      setLocalAgentSummary(emptyLocalAgentSummary)
      return
    }

    let cancelled = false
    setLocalAgentSummary((current) => ({ ...current, loading: true, error: '' }))

    void Promise.all([
      api.get('local-agent/devices').json<LocalAgentDevicesResponse>(),
      api.get('local-agent/grants', { searchParams: { channel_id: channelId } }).json<LocalAgentGrantsResponse>(),
    ])
      .then(([deviceData, grantData]) => {
        if (cancelled) return
        const devices = (deviceData.devices ?? []).filter((device) => !device.revoked_at)
        const grants = (grantData.grants ?? []).filter((grant) => !grant.revoked_at)
        setLocalAgentSummary({
          loading: false,
          totalDevices: devices.length,
          onlineDevices: devices.filter(localAgentDeviceOnline).length,
          grants: grants.length,
          writableGrants: grants.filter(localAgentGrantCanWrite).length,
          error: '',
        })
      })
      .catch(() => {
        if (cancelled) return
        setLocalAgentSummary({
          ...emptyLocalAgentSummary,
          error: 'LOCAL_AGENT_STATUS_UNAVAILABLE',
        })
      })

    return () => {
      cancelled = true
    }
  }, [api, channelId, localAgents.length])

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
      setTaskView(isRecurringScheduleInput(data) ? 'schedules' : 'calendar')
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
    if (!member.agent_id || !canConfigureAgentTier) return
    setSelectedAgent(member)
    setAgentSettingsOpen(true)
    setAgentSettingsLoading(true)
    try {
      const [identity, cfg] = await Promise.all([
        api.get(`channels/${channelId}/agents/${member.agent_id}/identity`).json<AgentIdentityForm>(),
        api.get(`channels/${channelId}/agents/${member.agent_id}/config`).json<AgentConfigForm>().catch(() => null),
      ])
      setAgentIdentity({
        name: identity.name || member.display_name || member.agent_id,
        personality: identity.personality || '',
        content: identity.content || '',
      })
      setAgentConfig(cfg ? { ...cfg, model_tier: normalizeModelTier(cfg.model_tier), skills: cfg.skills ?? [] } : null)
    } catch {
      setAgentIdentity({ name: member.display_name || member.agent_id, personality: '', content: '' })
      setAgentConfig(null)
    } finally {
      setAgentSettingsLoading(false)
    }
  }

  async function saveAgentSettings() {
    if (!selectedAgent?.agent_id) return
    setAgentSettingsSaving(true)
    try {
      if (canEditAgents) {
        await api.put(`channels/${channelId}/agents/${selectedAgent.agent_id}/identity`, { json: agentIdentity })
      }
      if (agentConfig && canEditAgents) {
        await api.put(`channels/${channelId}/agents/${selectedAgent.agent_id}/config`, {
          json: {
            ...agentConfig,
            role: agentConfig.role || selectedAgent.agent_id,
            identity: {
              ...(agentConfig.identity ?? {}),
              ...agentIdentity,
            },
          },
        })
      } else {
        await api.put(`channels/${channelId}/agents/${selectedAgent.agent_id}/model-tier`, {
          json: { model_tier: normalizeModelTier(agentConfig?.model_tier) },
        })
      }
      onMembersChanged?.()
      setAgentSettingsOpen(false)
    } finally {
      setAgentSettingsSaving(false)
    }
  }

  async function refreshChannelMemberSurface() {
    onMembersChanged?.()
    await channelsStore.getState().fetchChannels()
  }

  async function openAgentPicker() {
    if (!channelId || !canManageAgentMembers) return
    setAgentActionError('')
    setAgentQuery('')
    setAgentPickerOpen(true)
    try {
      const data = await api.get(`channels/${channelId}/agent-templates`).json<AgentTemplateSummary[]>()
      setAvailableAgents(data ?? [])
    } catch {
      setAvailableAgents([])
      setAgentActionError('加载可添加 Agent 失败')
    }
  }

  async function addChannelAgent(agentID: string) {
    if (!channelId || !agentID) return
    setAgentActionLoading(agentID)
    setAgentActionError('')
    try {
      await api.post(`channels/${channelId}/members`, { json: { agent_ids: [agentID] } })
      await refreshChannelMemberSurface()
      setAgentPickerOpen(false)
    } catch {
      setAgentActionError('添加 Agent 失败')
    } finally {
      setAgentActionLoading('')
    }
  }

  async function removeChannelAgent(agentID: string) {
    if (!channelId || !agentID) return false
    setAgentActionLoading(agentID)
    setAgentActionError('')
    try {
      await api.delete(`channels/${channelId}/members/agents/${encodeURIComponent(agentID)}`)
      await refreshChannelMemberSurface()
      return true
    } catch {
      setAgentActionError('移除 Agent 失败')
      return false
    } finally {
      setAgentActionLoading('')
    }
  }

  async function removeSelectedAgent() {
    if (!selectedAgent?.agent_id) return
    const removed = await removeChannelAgent(selectedAgent.agent_id)
    if (removed) setAgentSettingsOpen(false)
  }

  async function inviteUserToChannel() {
    const emails = parseInviteEmails(inviteEmails)
    if (!channelId || emails.length === 0) return
    setInviteStatus('')
    const result = await channelsStore.getState().inviteUsers(channelId, emails)
    if (result.error) {
      setInviteStatus(result.error)
      return
    }
    setInviteEmails('')
    setInviteStatus('邀请已发送，等待对方接受。')
  }

  async function openSkillModal() {
    setSkillQuery('')
    setSkillModalOpen(true)
    try {
      const data = await api.get('admin/skills').json<SkillSummary[]>()
      setAvailableSkills(data ?? [])
    } catch {
      setAvailableSkills([])
    }
  }

  function addAgentSkill(skillName: string) {
    if (!skillName) return
    setAgentConfig((current) => {
      const cfg = current ?? { role: selectedAgent?.agent_id, skills: [] }
      const skills = cfg.skills ?? []
      if (skills.includes(skillName)) return cfg
      return { ...cfg, skills: [...skills, skillName] }
    })
  }

  function removeAgentSkill(skillName: string) {
    setAgentConfig((current) => {
      if (!current) return current
      return { ...current, skills: (current.skills ?? []).filter((skill) => skill !== skillName) }
    })
  }

  function updateAgentModelTier(modelTier: ModelTierName | '') {
    setAgentConfig((current) => ({ ...(current ?? { role: selectedAgent?.agent_id, skills: [] }), model_tier: modelTier }))
  }

  function updateAgentAvatarPreset(avatarPreset: string) {
    setAgentConfig((current) => ({
      ...(current ?? { role: selectedAgent?.agent_id, skills: [] }),
      avatar_preset: avatarPreset,
    }))
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
            <CreateScheduledTaskDialog agents={cloudAgents} onSubmit={handleCreateScheduledTask} />
            <CreateTaskDialog agents={cloudAgents} onSubmit={handleCreateTask} />
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
                <TaskViewButton active={taskView === 'focus'} label="焦点" count={focusTaskItems.length} tone="focus" onClick={() => setTaskView('focus')} />
                <TaskViewButton active={taskView === 'calendar'} label="日程" count={upcomingEventItems.length} tone="calendar" onClick={() => setTaskView('calendar')} />
                <TaskViewButton active={taskView === 'schedules'} label="重复" count={recurringScheduleItems.length} tone="repeat" onClick={() => setTaskView('schedules')} />
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
                  <EmptyTaskState label="暂无重复任务" />
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
              data-testid="storage-open-dialog"
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
                <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                  <span className="shrink-0 text-[10px] text-primary">云存储</span>
                  {storageBreadcrumbs.map((crumb, index) => (
                    <span key={crumb.prefix || 'root'} className="flex min-w-0 items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">/</span>
                      <button
                        type="button"
                        className={cn(
                          'max-w-[92px] truncate text-[10px] transition-colors hover:text-foreground',
                          index === storageBreadcrumbs.length - 1 ? 'text-foreground' : 'text-muted-foreground',
                        )}
                        onClick={() => void browseStorage(crumb.prefix)}
                        title={crumb.label}
                      >
                        {crumb.label === '根目录' ? '当前对话' : crumb.label}
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex-1" />
                <Search className="w-3 h-3 text-muted-foreground" />
                <label className="cursor-pointer">
                  <Upload className="w-3 h-3 text-muted-foreground" />
                  <input type="file" className="hidden" onChange={(e) => { void uploadFromPicker(e.target.files?.[0]); e.target.value = '' }} />
                </label>
              </div>
              {storageDirectories.length === 0 && channelFiles.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 py-2">暂无文件</div>
              ) : (
                <div className="space-y-1.5">
                  {storageDirectories.slice(0, 5).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      className="group flex w-full items-start gap-2 rounded px-1 py-1 -mx-1 text-left transition-colors hover:bg-muted/30"
                      data-testid="detail-storage-directory-row"
                      data-storage-prefix={dir}
                      onClick={() => void browseStorage(dir)}
                    >
                      <FolderOpen className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{directoryDisplayName(dir)}</span>
                        <span className="block text-[10px] text-muted-foreground">文件夹</span>
                      </span>
                    </button>
                  ))}
                  {channelFiles.slice(0, Math.max(0, 5 - storageDirectories.length)).map((f) => {
                    const refText = storageRefFromKey(f.key)
                    const displayName = storageDisplayName(f)

                    return (
                      <div
                        key={f.key}
                        className="group flex items-start gap-2 rounded px-1 py-1 -mx-1 transition-colors hover:bg-muted/30"
                        data-testid="detail-storage-file-row"
                        data-storage-key={f.key}
                        data-storage-file-name={displayName}
                      >
                        <button
                          type="button"
                          data-testid="detail-storage-file-preview"
                          title="预览文件"
                          className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setStoragePreviewRef(refText)}
                        >
                          <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs">{displayName}</span>
                            <span className="block text-[10px] text-muted-foreground">{formatBytes(f.size)} · {formatTime(f.last_modified)}</span>
                          </span>
                        </button>
                        <button
                          title="引用到聊天"
                          className="hidden rounded p-1 text-muted-foreground hover:bg-muted group-hover:block"
                          onClick={() => referenceFile(f)}
                        >
                          <MessageSquareQuote className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div>
          <div className="flex items-center gap-1 px-4 py-3 hover:bg-muted/30 transition-colors">
            <button onClick={() => setMembersOpen(!membersOpen)} className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-left">成员</span>
              {membersOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {canManageAgentMembers && (
              <button
                type="button"
                title="添加 Agent"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => { void openAgentPicker() }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {canInviteUsers && (
              <button
                type="button"
                title="邀请用户"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => { setInviteStatus(''); setUserInviteOpen(true) }}
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {membersOpen && (
            <div className="px-4 pb-3">
              {agentActionError && (
                <div className="mb-2 rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                  {agentActionError}
                </div>
              )}
              {cloudAgents.length > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">云端 Agent — {cloudAgents.length}</div>
                  <div className="space-y-2 mb-3">
                    {cloudAgents.map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5">
                        <button
                          type="button"
                          title={canConfigureAgentTier ? '设置 Agent' : undefined}
                          onClick={() => { void openAgentSettings(m) }}
                          className={cn('rounded-full', canConfigureAgentTier && 'hover:ring-2 hover:ring-foreground/15')}
                          disabled={!canConfigureAgentTier}
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
              {localAgents.length > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">本地 Agent — {localAgents.length}</div>
                  <div className="space-y-2 mb-3">
                    {localAgents.map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5">
                        <Avatar className="size-7 shrink-0">
                          {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                          <AvatarFallback className="bg-[#f8fafc] text-[#41454d]">
                            <Monitor className="h-3.5 w-3.5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <div className="truncate text-xs font-medium">{m.display_name || '本地 Agent'}</div>
                            <Badge variant="outline" className="h-4 shrink-0 rounded px-1 py-0 text-[10px] font-normal">本地</Badge>
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">{localAgentStatusText(localAgentSummary)}</div>
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
      {storagePreviewRef && <StoragePreviewDialog channelId={channelId} refText={storagePreviewRef} onClose={() => setStoragePreviewRef(null)} />}

      <Dialog open={userInviteOpen} onOpenChange={setUserInviteOpen}>
        <DialogContent className="w-[min(360px,calc(100vw-2rem))]" onClose={() => setUserInviteOpen(false)}>
          <DialogHeader>
            <DialogTitle>邀请用户</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <Input
              value={inviteEmails}
              onChange={(event) => { setInviteEmails(event.target.value); setInviteStatus('') }}
              placeholder="输入用户邮箱"
            />
            <div className="text-[10px] leading-4 text-muted-foreground">多个邮箱可用逗号或空格分隔。</div>
            {inviteStatus && (
              <div className={cn('text-xs', inviteStatus.includes('已发送') ? 'text-emerald-700' : 'text-destructive')}>
                {inviteStatus}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setUserInviteOpen(false)}>关闭</Button>
            <Button type="button" disabled={parseInviteEmails(inviteEmails).length === 0} onClick={() => { void inviteUserToChannel() }}>
              发送邀请
            </Button>
          </DialogFooter>
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
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">模型等级</label>
                  <select
                    value={normalizeModelTier(agentConfig?.model_tier)}
                    onChange={(event) => updateAgentModelTier(normalizeModelTier(event.target.value))}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">继承 Agent 默认等级</option>
                    {MODEL_TIER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">仅选择等级，底层模型使用该 Agent 在管理后台配置的三档映射。</p>
                </div>
                {canEditAgents ? (
                  <>
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">头像</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateAgentAvatarPreset('')}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted',
                        (agentConfig?.avatar_preset ?? '') === '' ? 'border-[#181d26] ring-2 ring-[#181d26]/15' : 'border-border',
                      )}
                      title="默认头像"
                    >
                      <span className="text-[10px] font-medium text-muted-foreground">AI</span>
                    </button>
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => updateAgentAvatarPreset(preset)}
                        className={cn(
                          'size-9 overflow-hidden rounded-full border bg-background transition-colors hover:bg-muted',
                          agentConfig?.avatar_preset === preset ? 'border-[#181d26] ring-2 ring-[#181d26]/15' : 'border-border',
                        )}
                        title={preset}
                      >
                        <img src={avatarPresetUrl(preset)} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
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
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-xs font-medium text-muted-foreground">技能</label>
                    <Button variant="outline" size="sm" onClick={() => void openSkillModal()}>
                      <Plus className="h-3.5 w-3.5" />
                      添加技能
                    </Button>
                  </div>
                  {(agentConfig?.skills ?? []).length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                      未配置技能
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(agentConfig?.skills ?? []).map((skill) => {
                        const meta = availableSkills.find((item) => item.name === skill)
                        return (
                          <span key={skill} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs">
                            <SkillIcon name={skill} iconUrl={meta?.icon_url} className="size-5 rounded" />
                            <span className="font-mono">{meta?.display_name || skill}</span>
                            <button type="button" onClick={() => removeAgentSkill(skill)} className="text-muted-foreground hover:text-destructive" title="移除技能">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    当前账号可调整该 Agent 的模型等级；名称和技能由频道管理员维护。
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {canManageAgentMembers && selectedAgent?.agent_id && (
                <Button
                  variant="destructive"
                  onClick={() => { void removeSelectedAgent() }}
                  disabled={agentSettingsLoading || agentActionLoading === selectedAgent.agent_id}
                >
                  <Trash2 className="w-4 h-4" />
                  {agentActionLoading === selectedAgent.agent_id ? '移出中...' : '移出频道'}
                </Button>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setAgentSettingsOpen(false)}>取消</Button>
              <Button onClick={saveAgentSettings} disabled={agentSettingsLoading || agentSettingsSaving || !selectedAgent?.agent_id}>
                <Save className="w-4 h-4" />
                {agentSettingsSaving ? '保存中...' : '保存'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={skillModalOpen} onOpenChange={setSkillModalOpen}>
        <DialogContent className="w-[min(680px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0" onClose={() => setSkillModalOpen(false)}>
          <div className="border-b border-border p-4">
            <DialogHeader>
              <DialogTitle>添加技能</DialogTitle>
            </DialogHeader>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={skillQuery}
                onChange={(event) => setSkillQuery(event.target.value)}
                placeholder="搜索技能名称、分类、触发词..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-4">
            <div className="space-y-2">
              {availableSkills.filter((skill) => {
                const query = skillQuery.trim().toLowerCase()
                if (!query) return true
                return [skill.name, skill.display_name, skill.category, skill.description, ...(skill.triggers ?? [])]
                  .some((value) => (value ?? '').toLowerCase().includes(query))
              }).map((skill) => {
                const added = (agentConfig?.skills ?? []).includes(skill.name)
                return (
                  <div key={skill.name} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <SkillIcon name={skill.name} iconUrl={skill.icon_url} className="size-10 rounded-lg border border-border" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{skill.display_name || skill.name}</span>
                        {skill.category && <Badge variant="outline" className="text-[10px]">{skill.category}</Badge>}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{skill.name}</div>
                      {skill.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{skill.description}</p>}
                    </div>
                    <Button size="sm" onClick={() => addAgentSkill(skill.name)} disabled={added}>
                      {added ? '已添加' : '添加'}
                    </Button>
                  </div>
                )
              })}
              {availableSkills.length === 0 && (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">暂无可添加技能</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={agentPickerOpen} onOpenChange={setAgentPickerOpen}>
        <DialogContent className="w-[min(560px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0" onClose={() => setAgentPickerOpen(false)}>
          <div className="border-b border-border p-4">
            <DialogHeader>
              <DialogTitle>添加 Agent</DialogTitle>
            </DialogHeader>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={agentQuery}
                onChange={(event) => setAgentQuery(event.target.value)}
                placeholder="搜索 Agent 名称、Role、版本..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-4">
            {agentActionError && (
              <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {agentActionError}
              </div>
            )}
            {filteredAvailableAgents.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">暂无可添加 Agent</div>
            ) : (
              <div className="space-y-2">
                {filteredAvailableAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <Avatar className="size-9 shrink-0">
                      {agent.avatar_url ? <AvatarImage src={agent.avatar_url} /> : null}
                      <AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700">AI</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{agent.name || agent.id}</div>
                      <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {agent.role || agent.id}{agent.version ? ` · v${String(agent.version).replace(/^v/i, '')}` : ''}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => { void addChannelAgent(agent.id) }} disabled={agentActionLoading === agent.id}>
                      {agentActionLoading === agent.id ? '添加中...' : '添加'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
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

function TaskViewButton({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  tone: 'focus' | 'calendar' | 'repeat'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[10px] font-semibold leading-none',
          tone === 'focus' && 'border-[#9297a0]/45 bg-[#181d26] text-white',
          tone === 'calendar' && 'border-amber-200 bg-amber-50 text-amber-800',
          tone === 'repeat' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function isRecurringScheduleInput(data: CreateScheduledTaskInput) {
  return Boolean(data.cron_expr?.trim() || data.recurrence_rule?.trim())
}

function isFocusableTask(task: Task, now: number) {
  if (task.scheduler_state === 'template' || task.scheduler_state === 'cancelled' || task.scheduler_state === 'waiting_time') {
    return false
  }

  if (task.scheduled_start_at) {
    const startAt = new Date(task.scheduled_start_at).getTime()
    if (Number.isFinite(startAt) && startAt > now) {
      return false
    }
  }

  return true
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

const TASK_TYPE_META = {
  manual: { label: '手动', title: '手动任务', className: 'border-[#9297a0]/40 bg-[#f8fafc] text-[#41454d]' },
  agent: { label: 'Agent', title: '即时 Agent 任务', className: 'border-[#458fff]/30 bg-[#458fff]/10 text-[#254fad]' },
  once: { label: '计划', title: '一次性计划任务', className: 'border-amber-300/60 bg-amber-50 text-amber-800' },
  recurring: { label: '定时', title: '周期定时任务实例', className: 'border-emerald-300/60 bg-emerald-50 text-emerald-800' },
  dependency: { label: '依赖', title: '多步骤依赖任务', className: 'border-[#aa2d00]/25 bg-[#aa2d00]/10 text-[#aa2d00]' },
} as const

function CompactTaskRow({ task, assignedLabel, onClick }: { task: Task; assignedLabel?: string; onClick: () => void }) {
  const awaitingVerification = task.verification_status === 'pending' || task.scheduler_state === 'awaiting_verify'
  const waitingAssignment = task.status === 'pending' && task.scheduler_state === 'manual' && !task.assigned_agent_id
  const meta = awaitingVerification
    ? { label: '待验收', icon: CheckCircle2, badge: 'warning' as const }
    : waitingAssignment
      ? { label: '待分配', icon: Clock, badge: 'outline' as const }
    : TASK_STATUS_META[task.status]
  const StatusIcon = meta.icon
  const dependencyCount = task.depends_on_task_ids?.length || 0
  const typeMeta = getTaskTypeMeta(task)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-border bg-background px-2 py-2 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start gap-2">
        <StatusIcon className={cn(
          'mt-0.5 h-3.5 w-3.5 shrink-0',
          awaitingVerification && 'text-amber-500',
          task.status === 'done' && 'text-green-600',
          task.status === 'failed' && 'text-red-500',
          task.status === 'blocked' && 'text-amber-500',
          task.status === 'in_progress' && !awaitingVerification && 'text-blue-500',
          task.status === 'pending' && 'text-muted-foreground',
        )} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <TaskTypeBadge meta={typeMeta} />
            <div className="min-w-0 flex-1 truncate text-xs font-medium">{task.title}</div>
          </div>
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

function getTaskTypeMeta(task: Task) {
  if (task.scheduler_state === 'pending_deps' || (task.depends_on_task_ids && task.depends_on_task_ids.length > 0)) {
    return TASK_TYPE_META.dependency
  }
  if (task.parent_task_id && task.schedule_id) {
    return TASK_TYPE_META.recurring
  }
  if (task.schedule_id || task.scheduler_state === 'waiting_time' || task.scheduled_start_at) {
    return TASK_TYPE_META.once
  }
  if (task.assigned_agent_id) {
    return TASK_TYPE_META.agent
  }
  return TASK_TYPE_META.manual
}

function TaskTypeBadge({ meta }: { meta: typeof TASK_TYPE_META[keyof typeof TASK_TYPE_META] }) {
  return (
    <Badge
      variant="outline"
      title={meta.title}
      className={cn('h-5 shrink-0 px-1.5 py-0 text-[10px] font-medium leading-none', meta.className)}
    >
      {meta.label}
    </Badge>
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
