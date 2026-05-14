import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useCron(channelId: string | null) {
  const { cronStore } = useBeeSeedContext()
  const state = useStore(cronStore)

  useEffect(() => {
    if (!channelId) return
    void state.fetchJobs(channelId)
  }, [channelId])

  return {
    jobs: state.jobs,
    loading: state.loading,
    createJob: (data: Parameters<typeof state.createJob>[1]) => channelId ? state.createJob(channelId, data) : Promise.resolve(null),
    updateJob: (jobId: string, patch: Parameters<typeof state.updateJob>[2]) => channelId ? state.updateJob(channelId, jobId, patch) : Promise.resolve(),
    deleteJob: (jobId: string) => channelId ? state.deleteJob(channelId, jobId) : Promise.resolve(),
  }
}
