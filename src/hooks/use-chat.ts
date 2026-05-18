import { useCallback, useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'
import type { ChatMessage, ChannelMemberInfo } from '../core/types.js'

export function useChat(channelId: string | null) {
  const { channelsStore, messagesStore, ws } = useBeeSeedContext()
  const state = useStore(messagesStore)

  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    const s = messagesStore.getState()
    void s.fetchMessages(channelId).then(() => {
      if (cancelled || channelsStore.getState().currentChannelId !== channelId) return
      const latestMsgId = latestMessageId(s.getMessages(channelId))
      if (latestMsgId > 0) {
        ws.send({ type: 'read_ack', channel_id: channelId, msg_id: latestMsgId })
        channelsStore.getState().markRead(channelId)
      }
    })
    void s.fetchMembers(channelId)
    ws.send({ type: 'join_channel', channel_id: channelId })
    return () => {
      cancelled = true
      ws.send({ type: 'leave_channel', channel_id: channelId })
    }
  }, [channelId, channelsStore, messagesStore, ws])

  const send = useCallback(
    (content: string, metadata?: Record<string, unknown>) => {
      if (!channelId || !content.trim()) return
      messagesStore.getState().addOptimisticMessage(channelId, content.trim(), metadata)
      ws.send({ type: 'message', channel_id: channelId, content: content.trim(), metadata })
    },
    [channelId, ws, messagesStore],
  )

  const sendWithQuote = useCallback(
    (content: string, quoted: ChatMessage, metadata?: Record<string, unknown>) => {
      if (!channelId || !content.trim()) return
      const prefix = quoted.senderName
        ? `> ${quoted.senderName}: ${quoted.content.slice(0, 100)}\n\n`
        : ''
      messagesStore.getState().addOptimisticMessage(channelId, prefix + content.trim(), metadata)
      ws.send({ type: 'message', channel_id: channelId, content: prefix + content.trim(), metadata })
    },
    [channelId, ws, messagesStore],
  )

  const submitAnswer = useCallback(
    (askId: string, answers: Record<string, unknown>) => {
      if (!channelId) return
      messagesStore.getState().submitAskUserAnswer(channelId, askId, answers)
    },
    [channelId, messagesStore],
  )

  const ack = useCallback(
    (msgId: number) => {
      if (!channelId) return
      ws.send({ type: 'read_ack', channel_id: channelId, msg_id: msgId })
    },
    [channelId, ws],
  )

  const stopAgent = useCallback(
    (agentId: string, reason?: string, runId?: string) => {
      if (!channelId || !agentId) return
      const cleanReason = reason?.trim()
      const cleanRunId = runId?.trim()
      ws.send({
        type: 'stop_agent',
        channel_id: channelId,
        agent_id: agentId,
        ...(cleanRunId ? { run_id: cleanRunId } : {}),
        ...(cleanReason ? { reason: cleanReason } : {}),
      })
    },
    [channelId, ws],
  )

  const refreshMembers = useCallback(() => {
    if (!channelId) return
    void messagesStore.getState().fetchMembers(channelId)
  }, [channelId, messagesStore])

  const streams = channelId ? state.getStreams(channelId) : []
  const agentLoops = channelId ? state.getAgentLoops(channelId) : []
  const typings = channelId ? state.getTypings(channelId) : []
  const stream = streams[streams.length - 1]
  const agentLoop = channelId
    ? stream?.agentLoop
      ?? (stream?.agentId ? state.agentLoops.get(`${channelId}:${stream.agentId}:${stream.runId || stream.agentLoop?.runId || '_legacy'}`) : undefined)
      ?? state.getAgentLoop(channelId)
    : undefined

  return {
    messages: channelId ? state.getMessages(channelId) : [],
    stream,
    streams,
    agentLoop,
    agentLoops,
    members: channelId ? state.getMembers(channelId) : ([] as ChannelMemberInfo[]),
    typing: channelId ? state.getTyping(channelId) : '',
    typings,
    loading: state.loadingChannel === channelId,
    send,
    sendWithQuote,
    submitAnswer,
    stopAgent,
    ack,
    refreshMembers,
  }
}

function latestMessageId(messages: ChatMessage[]): number {
  return messages.reduce((latest, message) => (
    typeof message.msgId === 'number' && Number.isFinite(message.msgId)
      ? Math.max(latest, message.msgId)
      : latest
  ), 0)
}
