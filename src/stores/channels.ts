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
  createChannel: (input: { name: string; purpose?: string; agent_ids?: string[] }) => Promise<{ channel: ChannelWithMeta; members: ChannelMember[] } | null>
  deleteChannel: (channelId: string) => Promise<{ error: string | null }>
  requestJoin: (channelId: string) => Promise<{ error: string | null }>
  inviteUsers: (channelId: string, targets: string[]) => Promise<{ error: string | null }>
  updateUnread: (channelId: string, count: number) => void
  markRead: (channelId: string) => void
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
        const current = get().currentChannelId
        const nextCurrent = current && channels.some((channel) => channel.id === current) ? current : (channels[0]?.id ?? null)
        try {
          if (nextCurrent) sessionStorage.setItem('beeseed_current_channel', nextCurrent)
          else sessionStorage.removeItem('beeseed_current_channel')
        } catch {}
        set({ channels, currentChannelId: nextCurrent, loading: false })
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

    deleteChannel: async (channelId) => {
      if (!channelId) return { error: '频道不存在' }
      try {
        await config.api.delete(`channels/${encodeURIComponent(channelId)}`)
        const nextChannels = get().channels.filter((channel) => channel.id !== channelId)
        const current = get().currentChannelId
        const nextCurrent = current === channelId ? (nextChannels[0]?.id ?? null) : current
        try {
          if (nextCurrent) sessionStorage.setItem('beeseed_current_channel', nextCurrent)
          else sessionStorage.removeItem('beeseed_current_channel')
        } catch {}
        set({ channels: nextChannels, currentChannelId: nextCurrent })
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err.message : '删除频道失败' }
      }
    },

    requestJoin: async (channelId) => {
      const id = channelId.trim()
      if (!id) return { error: '请填写频道 ID' }
      try {
        await config.api.post(`channels/${encodeURIComponent(id)}/join-requests`)
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err.message : '申请加入失败' }
      }
    },

    inviteUsers: async (channelId, targets) => {
      const { emails, phones } = normalizeInviteTargets(targets)
      if (!channelId || (emails.length === 0 && phones.length === 0)) return { error: '请填写要邀请的手机号或邮箱' }
      try {
        const data = await config.api
          .post(`channels/${encodeURIComponent(channelId)}/invites`, { json: { emails, phones } })
          .json<{ created_count?: number; skipped_count?: number; skipped_emails?: string[]; skipped_phones?: string[] }>()
        if ((data.created_count ?? 0) === 0) {
          const skipped = [...(data.skipped_phones ?? []), ...(data.skipped_emails ?? [])]
          if (skipped.length > 0) {
            return { error: `未找到可邀请用户：${skipped.join(', ')}` }
          }
          return { error: '没有可邀请的用户，可能已经在频道中或邀请待处理' }
        }
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err.message : '邀请失败' }
      }
    },

    updateUnread: (channelId, count) => {
      const channels = get().channels
      const changed = channels.some((r) => r.id === channelId && r.unread_count !== count)
      if (!changed) return
      set({
        channels: channels.map((r) =>
          r.id === channelId ? { ...r, unread_count: count } : r,
        ),
      })
    },

    markRead: (channelId) => {
      get().updateUnread(channelId, 0)
    },

    reset: () => set({ channels: [], currentChannelId: null, loading: false }),
  }))
}

export type ChannelsStore = ReturnType<typeof createChannelsStore>

function normalizeInviteTargets(targets: string[]) {
  const emails: string[] = []
  const phones: string[] = []
  const seenEmails = new Set<string>()
  const seenPhones = new Set<string>()

  for (const raw of targets) {
    const target = raw.trim()
    if (!target) continue
    if (target.includes('@')) {
      const email = target.toLowerCase()
      if (!seenEmails.has(email)) {
        seenEmails.add(email)
        emails.push(email)
      }
      continue
    }
    const phone = target.replaceAll(' ', '').replaceAll('-', '')
    if (phone && !seenPhones.has(phone)) {
      seenPhones.add(phone)
      phones.push(phone)
    }
  }

  return { emails, phones }
}
