import { useCallback, useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'
import type { ChatMessage, RoomMemberInfo } from '../core/types.js'

export function useChat(roomId: string | null) {
  const { messagesStore, ws } = useBeeSeedContext()
  const state = useStore(messagesStore)

  useEffect(() => {
    if (!roomId) return
    const s = messagesStore.getState()
    void s.fetchMessages(roomId)
    void s.fetchMembers(roomId)
    ws.send({ type: 'join_room', room_id: roomId })
    return () => {
      ws.send({ type: 'leave_room', room_id: roomId })
    }
  }, [roomId])

  const send = useCallback(
    (content: string, metadata?: Record<string, unknown>) => {
      if (!roomId || !content.trim()) return
      messagesStore.getState().addOptimisticMessage(roomId, content.trim())
      ws.send({ type: 'message', room_id: roomId, content: content.trim(), metadata })
    },
    [roomId, ws, messagesStore],
  )

  const sendWithQuote = useCallback(
    (content: string, quoted: ChatMessage) => {
      if (!roomId || !content.trim()) return
      const prefix = quoted.senderName
        ? `> ${quoted.senderName}: ${quoted.content.slice(0, 100)}\n\n`
        : ''
      messagesStore.getState().addOptimisticMessage(roomId, prefix + content.trim())
      ws.send({ type: 'message', room_id: roomId, content: prefix + content.trim() })
    },
    [roomId, ws, messagesStore],
  )

  const submitAnswer = useCallback(
    (askId: string, answers: Record<string, unknown>) => {
      if (!roomId) return
      messagesStore.getState().submitAskUserAnswer(roomId, askId, answers)
    },
    [roomId, messagesStore],
  )

  const ack = useCallback(
    (msgId: number) => {
      if (!roomId) return
      ws.send({ type: 'read_ack', room_id: roomId, msg_id: msgId })
    },
    [roomId, ws],
  )

  const stopAgent = useCallback(
    (agentId: string, reason?: string) => {
      if (!roomId || !agentId) return
      const cleanReason = reason?.trim()
      ws.send({
        type: 'stop_agent',
        room_id: roomId,
        agent_id: agentId,
        ...(cleanReason ? { reason: cleanReason } : {}),
      })
    },
    [roomId, ws],
  )

  const streams = roomId ? state.getStreams(roomId) : []
  const agentLoops = roomId ? state.getAgentLoops(roomId) : []
  const typings = roomId ? state.getTypings(roomId) : []
  const stream = streams[streams.length - 1]
  const agentLoop = roomId
    ? stream?.agentLoop
      ?? (stream?.agentId ? state.agentLoops.get(`${roomId}:${stream.agentId}`) : undefined)
      ?? state.getAgentLoop(roomId)
    : undefined

  return {
    messages: roomId ? state.getMessages(roomId) : [],
    stream,
    streams,
    agentLoop,
    agentLoops,
    members: roomId ? state.getMembers(roomId) : ([] as RoomMemberInfo[]),
    typing: roomId ? state.getTyping(roomId) : '',
    typings,
    loading: state.loadingRoom === roomId,
    send,
    sendWithQuote,
    submitAnswer,
    stopAgent,
    ack,
  }
}
