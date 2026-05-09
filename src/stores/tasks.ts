import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { Project, Task, TaskComment } from '../core/types.js'
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_COMMENTS } from '../mocks/tasks.js'

export interface TasksState {
  projects: Project[]
  tasks: Task[]
  loading: boolean

  fetchProjects: (roomId: string) => Promise<void>
  fetchTasks: (roomId: string) => Promise<void>
  createTask: (roomId: string, data: Partial<Task>) => Promise<Task | null>
  updateTask: (roomId: string, taskId: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (roomId: string, taskId: string) => Promise<void>
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
    loading: false,

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

    reset: () => set({ projects: [], tasks: [], loading: false }),
  }))
}

export type TasksStore = ReturnType<typeof createTasksStore>
