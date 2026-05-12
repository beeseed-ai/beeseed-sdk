import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { Invite } from '../core/types.js'
import { MOCK_INVITES } from '../mocks/app-users.js'

export interface InvitesState {
  invites: Invite[]
  loading: boolean

  fetchInvites: () => Promise<void>
  createInvite: () => Promise<void>
  revokeInvite: (inviteId: string) => Promise<void>
}

export interface InvitesStoreConfig {
  api: KyInstance
  useMock?: boolean
}

const DEFAULT_EXPIRES_IN_HOURS = 168 // 7 days

export function createInvitesStore(config: InvitesStoreConfig) {
  return createStore<InvitesState>()((set, get) => ({
    invites: [],
    loading: false,

    fetchInvites: async () => {
      set({ loading: true })
      if (config.useMock) {
        setTimeout(() => {
          set({ invites: MOCK_INVITES, loading: false })
        }, 500)
        return
      }
      try {
        const data = await config.api.get('admin/invites').json<{ total: number; items: Invite[] }>()
        set({ invites: Array.isArray(data?.items) ? data.items : [], loading: false })
      } catch {
        set({ loading: false })
      }
    },

    createInvite: async () => {
      if (config.useMock) {
        const newInvite: Invite = {
          id: `inv-${Date.now()}`,
          token_prefix: `mock${Math.floor(Math.random() * 10000)}`,
          code: `NEWCODE${Math.floor(Math.random() * 10000)}`,
          created_by: 'user-001',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
        set({ invites: [newInvite, ...get().invites] })
        return
      }
      try {
        const invite = await config.api
          .post('admin/invites', { json: { expires_in_hours: DEFAULT_EXPIRES_IN_HOURS } })
          .json<Invite>()
        set({ invites: [invite, ...get().invites] })
      } catch { /* */ }
    },

    revokeInvite: async (inviteId) => {
      const stamp = new Date().toISOString()
      if (config.useMock) {
        set({ invites: get().invites.map(i => i.id === inviteId ? { ...i, revoked_at: stamp } : i) })
        return
      }
      try {
        await config.api.delete(`admin/invites/${inviteId}`)
        set({ invites: get().invites.map(i => i.id === inviteId ? { ...i, revoked_at: stamp } : i) })
      } catch { /* */ }
    }
  }))
}

export type InvitesStore = ReturnType<typeof createInvitesStore>
