import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { CalendarEvent, Project, Task, TaskComment, TaskSchedule, TaskSchedulerMetrics } from '../core/types.js'
import { MOCK_CALENDAR_EVENTS, MOCK_PROJECTS, MOCK_TASK_SCHEDULES, MOCK_TASKS, MOCK_COMMENTS } from '../mocks/tasks.js'

export type CreateScheduledTaskInput = {
  title: string
  description?: string
  assigned_agent_id?: string
  run_at?: string
  cron_expr?: string
  recurrence_rule?: string
  timezone?: string
  due_at?: string
  overlap_policy?: TaskSchedule['overlap_policy']
  catch_up_policy?: TaskSchedule['catch_up_policy']
}

export type UpdateTaskInput = Partial<Omit<Task, 'due_at' | 'scheduled_start_at'>> & {
  due_at?: string | null
  scheduled_start_at?: string | null
}

export type UpdateScheduledTaskInput = Partial<Pick<TaskSchedule, 'timezone' | 'run_at' | 'recurrence_rule' | 'next_fire_at' | 'enabled' | 'overlap_policy' | 'catch_up_policy'>> & {
  cron_expr?: string
}

export interface TasksState {
  projects: Project[]
  tasks: Task[]
  scheduledTasks: TaskSchedule[]
  calendarEvents: CalendarEvent[]
  metrics: TaskSchedulerMetrics | null
  loading: boolean
  schedulesLoading: boolean
  metricsLoading: boolean

  fetchProjects: (channelId: string) => Promise<void>
  fetchTasks: (channelId: string) => Promise<void>
  fetchMetrics: (channelId: string) => Promise<void>
  getTask: (channelId: string, taskId: string) => Promise<Task | null>
  createTask: (channelId: string, data: Partial<Task>) => Promise<Task | null>
  updateTask: (channelId: string, taskId: string, patch: UpdateTaskInput) => Promise<void>
  deleteTask: (channelId: string, taskId: string) => Promise<void>
  fetchScheduledTasks: (channelId: string) => Promise<void>
  createScheduledTask: (channelId: string, data: CreateScheduledTaskInput) => Promise<{ task?: Task; template?: Task; schedule: TaskSchedule } | null>
  updateScheduledTask: (channelId: string, scheduleId: string, patch: UpdateScheduledTaskInput) => Promise<void>
  deleteScheduledTask: (channelId: string, scheduleId: string) => Promise<void>
  fetchCalendar: (channelId: string, range?: { from?: string; to?: string }) => Promise<void>
  getComments: (channelId: string, taskId: string) => Promise<TaskComment[]>
  addComment: (channelId: string, taskId: string, content: string) => Promise<TaskComment | null>
  reset: () => void
}

export interface TasksStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createTasksStore(config: TasksStoreConfig) {
  return createStore<TasksState>()((set, get) => ({
    projects: [],
    tasks: [],
    scheduledTasks: [],
    calendarEvents: [],
    metrics: null,
    loading: false,
    schedulesLoading: false,
    metricsLoading: false,

    fetchProjects: async (channelId) => {
      if (config.useMock) { set({ projects: MOCK_PROJECTS }); return }
      try {
        const data = await config.api.get(`channels/${channelId}/projects`).json<{ projects: Project[] }>()
        set({ projects: data.projects })
      } catch { /* */ }
    },

    fetchTasks: async (channelId) => {
      set({ loading: true })
      if (config.useMock) { set({ tasks: MOCK_TASKS, loading: false }); return }
      try {
        const data = await config.api.get(`channels/${channelId}/tasks`).json<{ tasks: Task[] }>()
        set({ tasks: data.tasks, loading: false })
      } catch { set({ loading: false }) }
    },

    fetchMetrics: async (channelId) => {
      set({ metricsLoading: true })
      if (config.useMock) {
        set({ metrics: createMockMetrics(get().tasks, get().scheduledTasks), metricsLoading: false })
        return
      }
      try {
        const metrics = await config.api.get(`channels/${channelId}/task-metrics`).json<TaskSchedulerMetrics>()
        set({ metrics, metricsLoading: false })
      } catch { set({ metricsLoading: false }) }
    },

    createTask: async (channelId, data) => {
      if (config.useMock) {
        const task: Task = { id: `task-${Date.now()}`, channel_id: channelId, title: data.title || '', status: 'pending', priority: data.priority ?? 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...data }
        set({ tasks: [...get().tasks, task] })
        return task
      }
      try {
        const task = await config.api.post(`channels/${channelId}/tasks`, { json: data }).json<Task>()
        set({ tasks: [...get().tasks, task] })
        void get().fetchMetrics(channelId)
        return task
      } catch { return null }
    },

    getTask: async (channelId, taskId) => {
      const existing = get().tasks.find((task) => task.id === taskId)
      if (existing) return existing
      if (config.useMock) {
        return MOCK_TASKS.find((task) => task.id === taskId) || null
      }
      try {
        const task = await config.api.get(`channels/${channelId}/tasks/${taskId}`).json<Task>()
        set((state) => ({
          tasks: state.tasks.some((item) => item.id === task.id)
            ? state.tasks.map((item) => item.id === task.id ? task : item)
            : [...state.tasks, task],
        }))
        return task
      } catch { return null }
    },

    updateTask: async (channelId, taskId, patch) => {
      if (config.useMock) {
        set({ tasks: get().tasks.map((t) => t.id === taskId ? applyTaskPatch(t, patch) : t) })
        return
      }
      try {
        const updated = await config.api.patch(`channels/${channelId}/tasks/${taskId}`, { json: patch }).json<Task>()
        set({ tasks: get().tasks.map((t) => t.id === taskId ? updated : t) })
        void get().fetchMetrics(channelId)
      } catch { /* */ }
    },

    deleteTask: async (channelId, taskId) => {
      if (config.useMock) {
        set({
          tasks: get().tasks.filter((t) => t.id !== taskId),
          scheduledTasks: get().scheduledTasks.filter((s) => s.task_template_id !== taskId),
          calendarEvents: get().calendarEvents.filter((event) => event.task_id !== taskId),
        })
        return
      }
      try {
        await config.api.delete(`channels/${channelId}/tasks/${taskId}`)
        set({
          tasks: get().tasks.filter((t) => t.id !== taskId),
          scheduledTasks: get().scheduledTasks.filter((s) => s.task_template_id !== taskId),
          calendarEvents: get().calendarEvents.filter((event) => event.task_id !== taskId),
        })
        void get().fetchMetrics(channelId)
      } catch { /* */ }
    },

    fetchScheduledTasks: async (channelId) => {
      set({ schedulesLoading: true })
      if (config.useMock) { set({ scheduledTasks: MOCK_TASK_SCHEDULES, schedulesLoading: false }); return }
      try {
        const data = await config.api.get(`channels/${channelId}/scheduled-tasks`).json<{ scheduled_tasks: TaskSchedule[] }>()
        set({ scheduledTasks: data.scheduled_tasks || [], schedulesLoading: false })
      } catch { set({ schedulesLoading: false }) }
    },

    createScheduledTask: async (channelId, data) => {
      if (config.useMock) {
        const schedule: TaskSchedule = {
          id: `schedule-${Date.now()}`,
          channel_id: channelId,
          kind: data.cron_expr || data.recurrence_rule ? 'recurring' : 'once',
          timezone: data.timezone || 'Asia/Shanghai',
          run_at: data.run_at,
          recurrence_rule: data.recurrence_rule || (data.cron_expr ? `CRON:${data.cron_expr}` : undefined),
          next_fire_at: data.run_at,
          enabled: true,
          overlap_policy: data.overlap_policy || 'skip',
          catch_up_policy: data.catch_up_policy || 'latest',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        set({ scheduledTasks: [...get().scheduledTasks, schedule] })
        return { schedule }
      }
      try {
        const result = await config.api.post(`channels/${channelId}/scheduled-tasks`, { json: data }).json<{ task?: Task; template?: Task; schedule: TaskSchedule }>()
        const schedule = { ...result.schedule, template_title: result.template?.title || result.task?.title || result.schedule.template_title }
        set({ scheduledTasks: [...get().scheduledTasks, schedule] })
        void get().fetchMetrics(channelId)
        return { ...result, schedule }
      } catch { return null }
    },

    updateScheduledTask: async (channelId, scheduleId, patch) => {
      if (config.useMock) {
        set({ scheduledTasks: get().scheduledTasks.map((s) => s.id === scheduleId ? { ...s, ...patch } : s) })
        return
      }
      try {
        const updated = await config.api.patch(`channels/${channelId}/scheduled-tasks/${scheduleId}`, { json: patch }).json<TaskSchedule>()
        set({
          scheduledTasks: get().scheduledTasks.map((s) => s.id === scheduleId
            ? {
                ...s,
                ...updated,
                template_title: updated.template_title || s.template_title,
                template_description: updated.template_description || s.template_description,
                assigned_agent_id: updated.assigned_agent_id || s.assigned_agent_id,
              }
            : s),
        })
        void get().fetchMetrics(channelId)
      } catch { /* */ }
    },

    deleteScheduledTask: async (channelId, scheduleId) => {
      if (config.useMock) {
        set({
          scheduledTasks: get().scheduledTasks.filter((s) => s.id !== scheduleId),
          tasks: get().tasks.filter((task) => task.schedule_id !== scheduleId),
          calendarEvents: get().calendarEvents.filter((event) => event.schedule_id !== scheduleId),
        })
        return
      }
      try {
        await config.api.delete(`channels/${channelId}/scheduled-tasks/${scheduleId}`)
        set({
          scheduledTasks: get().scheduledTasks.filter((s) => s.id !== scheduleId),
          tasks: get().tasks.filter((task) => task.schedule_id !== scheduleId),
          calendarEvents: get().calendarEvents.filter((event) => event.schedule_id !== scheduleId),
        })
        void get().fetchMetrics(channelId)
      } catch { /* */ }
    },

    fetchCalendar: async (channelId, range) => {
      if (config.useMock) { set({ calendarEvents: MOCK_CALENDAR_EVENTS }); return }
      try {
        const params = new URLSearchParams()
        if (range?.from) params.set('from', range.from)
        if (range?.to) params.set('to', range.to)
        const suffix = params.toString() ? `?${params.toString()}` : ''
        const data = await config.api.get(`channels/${channelId}/calendar${suffix}`).json<{ events: CalendarEvent[] }>()
        set({ calendarEvents: data.events || [] })
      } catch { /* */ }
    },

    getComments: async (channelId, taskId) => {
      if (config.useMock) return MOCK_COMMENTS.filter((c) => c.task_id === taskId)
      try {
        const data = await config.api.get(`channels/${channelId}/tasks/${taskId}/comments`).json<{ comments: TaskComment[] }>()
        return data.comments
      } catch { return [] }
    },

    addComment: async (channelId, taskId, content) => {
      if (config.useMock) {
        return {
          id: Date.now(),
          task_id: taskId,
          author_type: 'user',
          content,
          comment_type: 'comment',
          created_at: new Date().toISOString(),
        }
      }
      try {
        return await config.api.post(`channels/${channelId}/tasks/${taskId}/comments`, { json: { content } }).json<TaskComment>()
      } catch { return null }
    },

    reset: () => set({ projects: [], tasks: [], scheduledTasks: [], calendarEvents: [], metrics: null, loading: false, schedulesLoading: false, metricsLoading: false }),
  }))
}

export type TasksStore = ReturnType<typeof createTasksStore>

function applyTaskPatch(task: Task, patch: UpdateTaskInput): Task {
  const next = { ...task, ...patch } as Task
  if (patch.due_at === null) delete next.due_at
  if (patch.scheduled_start_at === null) delete next.scheduled_start_at
  return next
}

function createMockMetrics(tasks: Task[], schedules: TaskSchedule[]): TaskSchedulerMetrics {
  const byStatus = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1
    return acc
  }, {})
  const bySchedulerState = tasks.reduce<Record<string, number>>((acc, task) => {
    const state = task.scheduler_state || 'manual'
    acc[state] = (acc[state] || 0) + 1
    return acc
  }, {})
  return {
    total: tasks.length,
    open: tasks.filter((task) => task.status !== 'done' && task.status !== 'failed').length,
    ready: bySchedulerState.ready || 0,
    dispatched: bySchedulerState.dispatched || 0,
    awaiting_verify: bySchedulerState.awaiting_verify || 0,
    overdue: 0,
    pending_deps: bySchedulerState.pending_deps || 0,
    waiting_time: bySchedulerState.waiting_time || 0,
    failed: byStatus.failed || 0,
    failed_24h: byStatus.failed || 0,
    blocked: byStatus.blocked || 0,
    retried: tasks.filter((task) => (task.retry_count || 0) > 0).length,
    schedules_enabled: schedules.filter((schedule) => schedule.enabled).length,
    schedules_due: 0,
    failure_codes: {},
    by_scheduler_state: bySchedulerState,
    by_status: byStatus,
    agent_busy_count: 0,
    updated_at: new Date().toISOString(),
  }
}
