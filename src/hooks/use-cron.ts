import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useCron(roomId: string | null) {
  const { cronStore } = useBeeSeedContext()
  const state = useStore(cronStore)

  useEffect(() => {
    if (!roomId) return
    void state.fetchJobs(roomId)
  }, [roomId])

  return {
    jobs: state.jobs,
    loading: state.loading,
    createJob: (data: Parameters<typeof state.createJob>[1]) => roomId ? state.createJob(roomId, data) : Promise.resolve(null),
    updateJob: (jobId: string, patch: Parameters<typeof state.updateJob>[2]) => roomId ? state.updateJob(roomId, jobId, patch) : Promise.resolve(),
    deleteJob: (jobId: string) => roomId ? state.deleteJob(roomId, jobId) : Promise.resolve(),
  }
}
