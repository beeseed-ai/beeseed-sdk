import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useTasks(channelId: string | null) {
  const { tasksStore } = useBeeSeedContext()
  const state = useStore(tasksStore)

  useEffect(() => {
    if (!channelId) return
    void state.fetchProjects(channelId)
    void state.fetchTasks(channelId)
    void state.fetchMetrics(channelId)
    void state.fetchScheduledTasks(channelId)
    void state.fetchCalendar(channelId)
  }, [channelId])

  return {
    projects: state.projects,
    tasks: state.tasks,
    scheduledTasks: state.scheduledTasks,
    calendarEvents: state.calendarEvents,
    metrics: state.metrics,
    loading: state.loading,
    schedulesLoading: state.schedulesLoading,
    metricsLoading: state.metricsLoading,
    getTask: (taskId: string) => channelId ? state.getTask(channelId, taskId) : Promise.resolve(null),
    fetchMetrics: () => channelId ? state.fetchMetrics(channelId) : Promise.resolve(),
    createTask: (data: Parameters<typeof state.createTask>[1]) => channelId ? state.createTask(channelId, data) : Promise.resolve(null),
    updateTask: (taskId: string, patch: Parameters<typeof state.updateTask>[2]) => channelId ? state.updateTask(channelId, taskId, patch) : Promise.resolve(),
    deleteTask: (taskId: string) => channelId ? state.deleteTask(channelId, taskId) : Promise.resolve(),
    fetchScheduledTasks: () => channelId ? state.fetchScheduledTasks(channelId) : Promise.resolve(),
    createScheduledTask: (data: Parameters<typeof state.createScheduledTask>[1]) => channelId ? state.createScheduledTask(channelId, data) : Promise.resolve(null),
    updateScheduledTask: (scheduleId: string, patch: Parameters<typeof state.updateScheduledTask>[2]) => channelId ? state.updateScheduledTask(channelId, scheduleId, patch) : Promise.resolve(),
    deleteScheduledTask: (scheduleId: string) => channelId ? state.deleteScheduledTask(channelId, scheduleId) : Promise.resolve(),
    fetchCalendar: (range?: Parameters<typeof state.fetchCalendar>[1]) => channelId ? state.fetchCalendar(channelId, range) : Promise.resolve(),
    getComments: (taskId: string) => channelId ? state.getComments(channelId, taskId) : Promise.resolve([]),
    addComment: (taskId: string, content: string) => channelId ? state.addComment(channelId, taskId, content) : Promise.resolve(null),
  }
}
