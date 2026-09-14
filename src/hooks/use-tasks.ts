import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useTasks(channelId: string | null) {
  const { tasksStore } = useBeeSeedContext()
  const state = useStore(tasksStore)

  useEffect(() => {
    state.selectChannel(channelId)
    if (!channelId) return
    void state.fetchProjects(channelId)
    void state.fetchTasks(channelId)
    void state.fetchMetrics(channelId)
    void state.fetchScheduledTasks(channelId)
    void state.fetchCalendar(channelId)
  }, [channelId])

  const current = state.channelId === channelId
  return {
    projects: current ? state.projects : [],
    tasks: current ? state.tasks : [],
    scheduledTasks: current ? state.scheduledTasks : [],
    calendarEvents: current ? state.calendarEvents : [],
    metrics: current ? state.metrics : null,
    loading: current ? state.loading : Boolean(channelId),
    schedulesLoading: current ? state.schedulesLoading : Boolean(channelId),
    metricsLoading: current ? state.metricsLoading : Boolean(channelId),
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
