import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { ChannelWithMeta, ChannelMember } from '../core/types.js'

export interface ChannelsState {
  channels: ChannelWithMeta[]
  currentChannelId: string | null
  loading: boolean

  fetchChannels: () => Promise<void>
  setCurrentChannel: (channelId: string | null) => void
  setChannels: (channels: ChannelWithMeta[]) => void
  createChannel: (input: { name: string; purpose?: string }) => Promise<{ channel: ChannelWithMeta; members: ChannelMember[] } | null>
  updateUnread: (channelId: string, count: number) => void
  reset: () => void
}

export interface ChannelsStoreConfig {
  api: KyInstance
}

export function createChannelsStore(config: ChannelsStoreConfig) {
  return createStore<ChannelsState>()((set, get) => ({
    channels: [],
    currentChannelId: (() => { try { return sessionStorage.getItem('beeseed_current_channel') } catch { return null } })(),
    loading: false,

    fetchChannels: async () => {
      set({ loading: true })
      try {
        const channels = await config.api.get('channels').json<ChannelWithMeta[]>()
        set({ channels, loading: false })
      } catch {
        set({ loading: false })
      }
    },

    setCurrentChannel: (channelId) => {
      try { if (channelId) sessionStorage.setItem('beeseed_current_channel', channelId); else sessionStorage.removeItem('beeseed_current_channel') } catch {}
      set({ currentChannelId: channelId })
    },

    setChannels: (channels) => set({ channels }),

    createChannel: async (input) => {
      try {
        const data = await config.api.post('channels', {
          json: input,
        }).json<{ channel?: ChannelWithMeta; members: ChannelMember[] }>()
        const channel = data.channel
        if (!channel) return null
        set({ channels: [channel, ...get().channels] })
        return { channel: channel, members: data.members }
      } catch {
        return null
      }
    },

    updateUnread: (channelId, count) => {
      set({
        channels: get().channels.map((r) =>
          r.id === channelId ? { ...r, unread_count: count } : r,
        ),
      })
    },

    reset: () => set({ channels: [], currentChannelId: null, loading: false }),
  }))
}

export type ChannelsStore = ReturnType<typeof createChannelsStore>
