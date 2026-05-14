import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { CalendarEvent, Project, Task, TaskComment, TaskSchedule } from '../core/types.js'
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

export type UpdateScheduledTaskInput = Partial<Pick<TaskSchedule, 'timezone' | 'run_at' | 'recurrence_rule' | 'next_fire_at' | 'enabled' | 'overlap_policy' | 'catch_up_policy'>> & {
  cron_expr?: string
}

export interface TasksState {
  projects: Project[]
  tasks: Task[]
  scheduledTasks: TaskSchedule[]
  calendarEvents: CalendarEvent[]
  loading: boolean
  schedulesLoading: boolean

  fetchProjects: (roomId: string) => Promise<void>
  fetchTasks: (roomId: string) => Promise<void>
  createTask: (roomId: string, data: Partial<Task>) => Promise<Task | null>
  updateTask: (roomId: string, taskId: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (roomId: string, taskId: string) => Promise<void>
  fetchScheduledTasks: (roomId: string) => Promise<void>
  createScheduledTask: (roomId: string, data: CreateScheduledTaskInput) => Promise<{ task?: Task; template?: Task; schedule: TaskSchedule } | null>
  updateScheduledTask: (roomId: string, scheduleId: string, patch: UpdateScheduledTaskInput) => Promise<void>
  deleteScheduledTask: (roomId: string, scheduleId: string) => Promise<void>
  fetchCalendar: (roomId: string, range?: { from?: string; to?: string }) => Promise<void>
  getComments: (roomId: string, taskId: string) => Promise<TaskComment[]>
  addComment: (roomId: string, taskId: string, content: string) => Promise<void>
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
    loading: false,
    schedulesLoading: false,

    fetchProjects: async (roomId) => {
      if (config.useMock) { set({ projects: MOCK_PROJECTS }); return }
      try {
        const data = await config.api.get(`rooms/${roomId}/projects`).json<{ projects: Project[] }>()
        set({ projects: data.projects })
      } catch { /* */ }
    },

    fetchTasks: async (roomId) => {
      set({ loading: true })
      if (config.useMock) { set({ tasks: MOCK_TASKS, loading: false }); return }
      try {
        const data = await config.api.get(`rooms/${roomId}/tasks`).json<{ tasks: Task[] }>()
        set({ tasks: data.tasks, loading: false })
      } catch { set({ loading: false }) }
    },

    createTask: async (roomId, data) => {
      if (config.useMock) {
        const task: Task = { id: `task-${Date.now()}`, room_id: roomId, title: data.title || '', status: 'pending', priority: data.priority ?? 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...data }
        set({ tasks: [...get().tasks, task] })
        return task
      }
      try {
        const task = await config.api.post(`rooms/${roomId}/tasks`, { json: data }).json<Task>()
        set({ tasks: [...get().tasks, task] })
        return task
      } catch { return null }
    },

    updateTask: async (roomId, taskId, patch) => {
      if (config.useMock) {
        set({ tasks: get().tasks.map((t) => t.id === taskId ? { ...t, ...patch } : t) })
        return
      }
      try {
        const updated = await config.api.patch(`rooms/${roomId}/tasks/${taskId}`, { json: patch }).json<Task>()
        set({ tasks: get().tasks.map((t) => t.id === taskId ? updated : t) })
      } catch { /* */ }
    },

    deleteTask: async (roomId, taskId) => {
      if (config.useMock) { set({ tasks: get().tasks.filter((t) => t.id !== taskId) }); return }
      try {
        await config.api.delete(`rooms/${roomId}/tasks/${taskId}`)
        set({ tasks: get().tasks.filter((t) => t.id !== taskId) })
      } catch { /* */ }
    },

    fetchScheduledTasks: async (roomId) => {
      set({ schedulesLoading: true })
      if (config.useMock) { set({ scheduledTasks: MOCK_TASK_SCHEDULES, schedulesLoading: false }); return }
      try {
        const data = await config.api.get(`rooms/${roomId}/scheduled-tasks`).json<{ scheduled_tasks: TaskSchedule[] }>()
        set({ scheduledTasks: data.scheduled_tasks || [], schedulesLoading: false })
      } catch { set({ schedulesLoading: false }) }
    },

    createScheduledTask: async (roomId, data) => {
      if (config.useMock) {
        const schedule: TaskSchedule = {
          id: `schedule-${Date.now()}`,
          room_id: roomId,
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
        const result = await config.api.post(`rooms/${roomId}/scheduled-tasks`, { json: data }).json<{ task?: Task; template?: Task; schedule: TaskSchedule }>()
        const schedule = { ...result.schedule, template_title: result.template?.title || result.task?.title || result.schedule.template_title }
        set({ scheduledTasks: [...get().scheduledTasks, schedule] })
        return { ...result, schedule }
      } catch { return null }
    },

    updateScheduledTask: async (roomId, scheduleId, patch) => {
      if (config.useMock) {
        set({ scheduledTasks: get().scheduledTasks.map((s) => s.id === scheduleId ? { ...s, ...patch } : s) })
        return
      }
      try {
        const updated = await config.api.patch(`rooms/${roomId}/scheduled-tasks/${scheduleId}`, { json: patch }).json<TaskSchedule>()
        set({ scheduledTasks: get().scheduledTasks.map((s) => s.id === scheduleId ? updated : s) })
      } catch { /* */ }
    },

    deleteScheduledTask: async (roomId, scheduleId) => {
      if (config.useMock) { set({ scheduledTasks: get().scheduledTasks.filter((s) => s.id !== scheduleId) }); return }
      try {
        await config.api.delete(`rooms/${roomId}/scheduled-tasks/${scheduleId}`)
        set({ scheduledTasks: get().scheduledTasks.filter((s) => s.id !== scheduleId) })
      } catch { /* */ }
    },

    fetchCalendar: async (roomId, range) => {
      if (config.useMock) { set({ calendarEvents: MOCK_CALENDAR_EVENTS }); return }
      try {
        const params = new URLSearchParams()
        if (range?.from) params.set('from', range.from)
        if (range?.to) params.set('to', range.to)
        const suffix = params.toString() ? `?${params.toString()}` : ''
        const data = await config.api.get(`rooms/${roomId}/calendar${suffix}`).json<{ events: CalendarEvent[] }>()
        set({ calendarEvents: data.events || [] })
      } catch { /* */ }
    },

    getComments: async (roomId, taskId) => {
      if (config.useMock) return MOCK_COMMENTS.filter((c) => c.task_id === taskId)
      try {
        const data = await config.api.get(`rooms/${roomId}/tasks/${taskId}/comments`).json<{ comments: TaskComment[] }>()
        return data.comments
      } catch { return [] }
    },

    addComment: async (roomId, taskId, content) => {
      if (config.useMock) return
      try {
        await config.api.post(`rooms/${roomId}/tasks/${taskId}/comments`, { json: { content } })
      } catch { /* */ }
    },

    reset: () => set({ projects: [], tasks: [], scheduledTasks: [], calendarEvents: [], loading: false, schedulesLoading: false }),
  }))
}

export type TasksStore = ReturnType<typeof createTasksStore>
