import { useCallback, useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'
import type { ChatMessage, RoomMemberInfo } from '../core/types.js'

export function useChat(roomId: string | null) {
  const { messagesStore, ws } = useBeeSeedContext()
  const state = useStore(messagesStore)

  useEffect(() => {
    if (!roomId) return
    void state.fetchMessages(roomId)
    void state.fetchMembers(roomId)
    ws.send({ type: 'join_room', room_id: roomId })
    return () => {
      ws.send({ type: 'leave_room', room_id: roomId })
    }
  }, [roomId])

  const send = useCallback(
    (content: string, metadata?: Record<string, unknown>) => {
      if (!roomId || !content.trim()) return
      ws.send({ type: 'message', room_id: roomId, content: content.trim(), metadata })
    },
    [roomId, ws],
  )

  const sendWithQuote = useCallback(
    (content: string, quoted: ChatMessage) => {
      if (!roomId || !content.trim()) return
      const prefix = quoted.senderName
        ? `> ${quoted.senderName}: ${quoted.content.slice(0, 100)}\n\n`
        : ''
      ws.send({ type: 'message', room_id: roomId, content: prefix + content.trim() })
    },
    [roomId, ws],
  )

  const submitAnswer = useCallback(
    (askId: string, answers: Record<string, unknown>) => {
      if (!roomId) return
      state.submitAskUserAnswer(roomId, askId, answers)
    },
    [roomId, state],
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
    agentLoop: roomId ? state.getAgentLoop(roomId) : undefined,
    members: roomId ? state.getMembers(roomId) : ([] as RoomMemberInfo[]),
    typing: roomId ? state.getTyping(roomId) : '',
    loading: state.loadingRoom === roomId,
    send,
    sendWithQuote,
    submitAnswer,
    ack,
  }
}
