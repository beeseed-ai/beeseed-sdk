import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { RegistrationPolicy } from '../core/types.js'

export interface AppSettingsState {
  registrationPolicy: RegistrationPolicy
  loading: boolean

  fetchSettings: () => Promise<void>
  setRegistrationPolicy: (policy: RegistrationPolicy) => Promise<void>
}

export interface AppSettingsStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createAppSettingsStore(config: AppSettingsStoreConfig) {
  return createStore<AppSettingsState>()((set) => ({
    registrationPolicy: 'invite', // default for mock
    loading: false,

    fetchSettings: async () => {
      set({ loading: true })
      if (config.useMock) {
        setTimeout(() => {
          set({ loading: false })
        }, 500)
        return
      }
      try {
        const data = await config.api.get('auth/registration-policy').json<{ policy: RegistrationPolicy }>()
        set({ registrationPolicy: data.policy, loading: false })
      } catch {
        set({ loading: false })
      }
    },

    setRegistrationPolicy: async (policy) => {
      if (config.useMock) {
        set({ registrationPolicy: policy })
        return
      }
      try {
        await config.api.patch('admin/settings/registration', { json: { policy } })
        set({ registrationPolicy: policy })
      } catch { /* */ }
    }
  }))
}

export type AppSettingsStore = ReturnType<typeof createAppSettingsStore>