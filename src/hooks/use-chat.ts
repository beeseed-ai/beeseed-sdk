import { useCallback, useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'
import type { ChatMessage, ChannelMemberInfo } from '../core/types.js'
import { latestPendingAskUserForUser, pendingAskUserKey, readAckBeforePendingAsk } from '../lib/ask-user-action.js'

interface UseChatOptions {
  markRead?: boolean
}

export function useChat(channelId: string | null, options?: UseChatOptions) {
  const { authStore, channelsStore, messagesStore, ws } = useBeeSeedContext()
  const state = useStore(messagesStore)
  const markRead = options?.markRead === true

  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    const s = messagesStore.getState()
    void s.fetchMessages(channelId).then(() => {
      if (cancelled) return
    })
    void s.fetchMembers(channelId)
    ws.send({ type: 'join_channel', channel_id: channelId })
    return () => {
      cancelled = true
    }
  }, [channelId, channelsStore, messagesStore, ws])

  const channelMessages = channelId ? state.getMessages(channelId) : []
  const latestMsgId = latestMessageId(channelMessages)
  const pendingAskUserMessage = latestPendingAskUserForUser(channelMessages, authStore.getState().user?.id)
  const pendingAskKey = pendingAskUserKey(pendingAskUserMessage)
  useEffect(() => {
    if (!channelId || !markRead || latestMsgId <= 0) return
    const ackIfReading = () => {
      if (channelsStore.getState().currentChannelId !== channelId) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (typeof document !== 'undefined' && typeof document.hasFocus === 'function' && !document.hasFocus()) return
      if (pendingAskUserMessage) {
        const readableThroughMsgId = readAckBeforePendingAsk(pendingAskUserMessage)
        if (readableThroughMsgId > 0) {
          ws.send({ type: 'read_ack', channel_id: channelId, msg_id: readableThroughMsgId, reading: true })
        }
        const channel = channelsStore.getState().channels.find((item) => item.id === channelId)
        if ((channel?.unread_count ?? 0) === 0) channelsStore.getState().updateUnread(channelId, 1)
        return
      }
      ws.send({ type: 'read_ack', channel_id: channelId, msg_id: latestMsgId, reading: true })
      channelsStore.getState().markRead(channelId)
    }
    ackIfReading()
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    window.addEventListener('focus', ackIfReading)
    document.addEventListener('visibilitychange', ackIfReading)
    return () => {
      window.removeEventListener('focus', ackIfReading)
      document.removeEventListener('visibilitychange', ackIfReading)
    }
  }, [channelId, channelsStore, latestMsgId, markRead, pendingAskKey, pendingAskUserMessage, ws])

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
      ws.send({ type: 'read_ack', channel_id: channelId, msg_id: msgId, reading: true })
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

  const loadOlderMessages = useCallback(() => {
    if (!channelId) return Promise.resolve()
    return messagesStore.getState().loadOlderMessages(channelId)
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
    hasOlderMessages: channelId ? state.hasOlder(channelId) : false,
    loadingOlderMessages: channelId ? state.isLoadingOlder(channelId) : false,
    send,
    sendWithQuote,
    submitAnswer,
    stopAgent,
    ack,
    refreshMembers,
    loadOlderMessages,
  }
}

function latestMessageId(messages: ChatMessage[]): number {
  return messages.reduce((latest, message) => (
    typeof message.msgId === 'number' && Number.isFinite(message.msgId)
      ? Math.max(latest, message.msgId)
      : latest
  ), 0)
}
