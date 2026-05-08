import { useCallback, useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useChat(roomId: string | null) {
  const { messagesStore, ws } = useBeeSeedContext()
  const state = useStore(messagesStore)

  useEffect(() => {
    if (!roomId) return
    void state.fetchMessages(roomId)
    ws.send({ type: 'join_room', room_id: roomId })
    return () => {
      ws.send({ type: 'leave_room', room_id: roomId })
    }
  }, [roomId])

  const send = useCallback(
    (content: string) => {
      if (!roomId || !content.trim()) return
      ws.send({ type: 'message', room_id: roomId, content: content.trim() })
    },
    [roomId, ws],
  )

  const ack = useCallback(
    (msgId: number) => {
      if (!roomId) return
      ws.send({ type: 'read_ack', room_id: roomId, msg_id: msgId })
    },
    [roomId, ws],
  )

  return {
    messages: roomId ? state.getMessages(roomId) : [],
    stream: roomId ? state.getStream(roomId) : undefined,
    typing: roomId ? state.getTyping(roomId) : '',
    loading: state.loadingRoom === roomId,
    send,
    ack,
  }
}
