import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useTasks(roomId: string | null) {
  const { tasksStore } = useBeeSeedContext()
  const state = useStore(tasksStore)

  useEffect(() => {
    if (!roomId) return
    void state.fetchProjects(roomId)
    void state.fetchTasks(roomId)
    void state.fetchScheduledTasks(roomId)
    void state.fetchCalendar(roomId)
  }, [roomId])

  return {
    projects: state.projects,
    tasks: state.tasks,
    scheduledTasks: state.scheduledTasks,
    calendarEvents: state.calendarEvents,
    loading: state.loading,
    schedulesLoading: state.schedulesLoading,
    createTask: (data: Parameters<typeof state.createTask>[1]) => roomId ? state.createTask(roomId, data) : Promise.resolve(null),
    updateTask: (taskId: string, patch: Parameters<typeof state.updateTask>[2]) => roomId ? state.updateTask(roomId, taskId, patch) : Promise.resolve(),
    deleteTask: (taskId: string) => roomId ? state.deleteTask(roomId, taskId) : Promise.resolve(),
    fetchScheduledTasks: () => roomId ? state.fetchScheduledTasks(roomId) : Promise.resolve(),
    createScheduledTask: (data: Parameters<typeof state.createScheduledTask>[1]) => roomId ? state.createScheduledTask(roomId, data) : Promise.resolve(null),
    updateScheduledTask: (scheduleId: string, patch: Parameters<typeof state.updateScheduledTask>[2]) => roomId ? state.updateScheduledTask(roomId, scheduleId, patch) : Promise.resolve(),
    deleteScheduledTask: (scheduleId: string) => roomId ? state.deleteScheduledTask(roomId, scheduleId) : Promise.resolve(),
    fetchCalendar: (range?: Parameters<typeof state.fetchCalendar>[1]) => roomId ? state.fetchCalendar(roomId, range) : Promise.resolve(),
    getComments: (taskId: string) => roomId ? state.getComments(roomId, taskId) : Promise.resolve([]),
    addComment: (taskId: string, content: string) => roomId ? state.addComment(roomId, taskId, content) : Promise.resolve(),
  }
}
