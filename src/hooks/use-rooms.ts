import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useRooms() {
  const { roomsStore, ws } = useBeeSeedContext()
  const state = useStore(roomsStore)

  return {
    ...state,
    joinRoom: (roomId: string) => {
      state.setCurrentRoom(roomId)
      ws.send({ type: 'join_room', room_id: roomId })
    },
    leaveRoom: (roomId: string) => {
      ws.send({ type: 'leave_room', room_id: roomId })
      if (state.currentRoomId === roomId) state.setCurrentRoom(null)
    },
  }
}
