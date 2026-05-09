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
  }, [roomId])

  return {
    projects: state.projects,
    tasks: state.tasks,
    loading: state.loading,
    createTask: (data: Parameters<typeof state.createTask>[1]) => roomId ? state.createTask(roomId, data) : Promise.resolve(null),
    updateTask: (taskId: string, patch: Parameters<typeof state.updateTask>[2]) => roomId ? state.updateTask(roomId, taskId, patch) : Promise.resolve(),
    deleteTask: (taskId: string) => roomId ? state.deleteTask(roomId, taskId) : Promise.resolve(),
    getComments: (taskId: string) => roomId ? state.getComments(roomId, taskId) : Promise.resolve([]),
    addComment: (taskId: string, content: string) => roomId ? state.addComment(roomId, taskId, content) : Promise.resolve(),
  }
}
