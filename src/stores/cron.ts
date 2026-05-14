import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { CronJob } from '../core/types.js'
import { MOCK_CRON_JOBS } from '../mocks/cron.js'

export interface CronState {
  jobs: CronJob[]
  loading: boolean

  fetchJobs: (channelId: string) => Promise<void>
  createJob: (channelId: string, data: Partial<CronJob>) => Promise<CronJob | null>
  updateJob: (channelId: string, jobId: string, patch: Partial<CronJob>) => Promise<void>
  deleteJob: (channelId: string, jobId: string) => Promise<void>
  reset: () => void
}

export interface CronStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createCronStore(config: CronStoreConfig) {
  return createStore<CronState>()((set, get) => ({
    jobs: [],
    loading: false,

    fetchJobs: async (channelId) => {
      set({ loading: true })
      if (config.useMock) { set({ jobs: MOCK_CRON_JOBS, loading: false }); return }
      try {
        const data = await config.api.get(`channels/${channelId}/cron`).json<{ cron_jobs: CronJob[] }>()
        set({ jobs: data.cron_jobs || [], loading: false })
      } catch { set({ loading: false }) }
    },

    createJob: async (channelId, data) => {
      if (config.useMock) {
        const job: CronJob = { id: `cron-${Date.now()}`, channel_id: channelId, cron_expr: data.cron_expr || '0 9 * * *', message: data.message || '', timezone: data.timezone || 'Asia/Shanghai', enabled: true, created_at: new Date().toISOString(), ...data }
        set({ jobs: [...get().jobs, job] })
        return job
      }
      try {
        const job = await config.api.post(`channels/${channelId}/cron`, { json: data }).json<CronJob>()
        set({ jobs: [...get().jobs, job] })
        return job
      } catch { return null }
    },

    updateJob: async (channelId, jobId, patch) => {
      if (config.useMock) {
        set({ jobs: get().jobs.map((j) => j.id === jobId ? { ...j, ...patch } : j) })
        return
      }
      try {
        const updated = await config.api.patch(`channels/${channelId}/cron/${jobId}`, { json: patch }).json<CronJob>()
        set({ jobs: get().jobs.map((j) => j.id === jobId ? updated : j) })
      } catch { /* */ }
    },

    deleteJob: async (channelId, jobId) => {
      if (config.useMock) { set({ jobs: get().jobs.filter((j) => j.id !== jobId) }); return }
      try {
        await config.api.delete(`channels/${channelId}/cron/${jobId}`)
        set({ jobs: get().jobs.filter((j) => j.id !== jobId) })
      } catch { /* */ }
    },

    reset: () => set({ jobs: [], loading: false }),
  }))
}

export type CronStore = ReturnType<typeof createCronStore>
