import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { ApplicationAccessPolicy, ApplicationJoinMode, RegistrationPolicy } from '../core/types.js'

export interface AppSettingsState {
  registrationPolicy: RegistrationPolicy
  accessPolicy: ApplicationAccessPolicy | null
  joinMode: ApplicationJoinMode
  allowNewHiveUsers: boolean
  loading: boolean

  fetchSettings: () => Promise<void>
  setRegistrationPolicy: (policy: RegistrationPolicy) => Promise<void>
  setJoinMode: (mode: ApplicationJoinMode) => Promise<void>
}

export interface AppSettingsStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createAppSettingsStore(config: AppSettingsStoreConfig) {
  return createStore<AppSettingsState>()((set) => ({
    registrationPolicy: 'invite', // default for mock
    accessPolicy: null,
    joinMode: 'invite',
    allowNewHiveUsers: true,
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
        const policy = await config.api.get('admin/access-policy').json<ApplicationAccessPolicy>()
        set({
          accessPolicy: policy,
          joinMode: policy.join_mode,
          allowNewHiveUsers: policy.allow_new_hive_users,
          registrationPolicy: registrationPolicyFromJoinMode(policy.join_mode),
          loading: false,
        })
      } catch {
        try {
          const data = await config.api.get('auth/registration-policy').json<{ policy: RegistrationPolicy }>()
          const joinMode = joinModeFromRegistrationPolicy(data.policy)
          set({ registrationPolicy: data.policy, joinMode, loading: false })
        } catch {
          set({ loading: false })
        }
      }
    },

    setRegistrationPolicy: async (policy) => {
      const joinMode = joinModeFromRegistrationPolicy(policy)
      if (config.useMock) {
        set({ registrationPolicy: policy, joinMode })
        return
      }
      try {
        const next = await config.api.patch('admin/access-policy', { json: { join_mode: joinMode } }).json<ApplicationAccessPolicy>()
        set({
          accessPolicy: next,
          joinMode: next.join_mode,
          allowNewHiveUsers: next.allow_new_hive_users,
          registrationPolicy: registrationPolicyFromJoinMode(next.join_mode),
        })
      } catch {
        try {
          await config.api.patch('admin/settings/registration', { json: { policy } })
          set({ registrationPolicy: policy, joinMode })
        } catch { /* */ }
      }
    },

    setJoinMode: async (mode) => {
      if (config.useMock) {
        set({ joinMode: mode, registrationPolicy: registrationPolicyFromJoinMode(mode) })
        return
      }
      try {
        const next = await config.api.patch('admin/access-policy', { json: { join_mode: mode } }).json<ApplicationAccessPolicy>()
        set({
          accessPolicy: next,
          joinMode: next.join_mode,
          allowNewHiveUsers: next.allow_new_hive_users,
          registrationPolicy: registrationPolicyFromJoinMode(next.join_mode),
        })
      } catch { /* */ }
    }
  }))
}

export type AppSettingsStore = ReturnType<typeof createAppSettingsStore>

function registrationPolicyFromJoinMode(mode: ApplicationJoinMode): RegistrationPolicy {
  if (mode === 'invite' || mode === 'approval') return 'invite'
  if (mode === 'closed') return 'closed'
  return 'open'
}

function joinModeFromRegistrationPolicy(policy: RegistrationPolicy): ApplicationJoinMode {
  if (policy === 'invite') return 'invite'
  if (policy === 'closed') return 'closed'
  return 'auto'
}
