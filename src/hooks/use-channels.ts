import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useChannels() {
  const { channelsStore, ws } = useBeeSeedContext()
  const state = useStore(channelsStore)

  return {
    ...state,
    joinChannel: (channelId: string) => {
      state.setCurrentChannel(channelId)
      ws.send({ type: 'join_channel', channel_id: channelId })
    },
    leaveChannel: (channelId: string) => {
      ws.send({ type: 'leave_channel', channel_id: channelId })
      if (state.currentChannelId === channelId) state.setCurrentChannel(null)
    },
  }
}
