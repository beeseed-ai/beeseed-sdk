import { useEffect, useRef, useMemo, useCallback } from 'react'
import type { ChatMessage, StreamState, AgentLoopState, ChannelMemberInfo } from '../../core/types.js'
import { MessageBubble } from './MessageBubble.js'
import { ToolGroupBubble } from './ToolGroupBubble.js'
import { StreamRenderer } from './StreamRenderer.js'
import { AgentLoopTimeline } from './AgentLoopTimeline.js'

const CHAT_MAX_WIDTH = 820

type GroupedItem = ChatMessage | ChatMessage[]

function groupMessages(messages: ChatMessage[]): GroupedItem[] {
  const result: GroupedItem[] = []
  let toolBuf: ChatMessage[] = []
  const flushTools = () => { if (toolBuf.length > 0) { result.push([...toolBuf]); toolBuf = [] } }
  for (const msg of messages) {
    if (msg.role === 'tool' && msg.toolName !== 'ask_user') { toolBuf.push(msg) } else { flushTools(); result.push(msg) }
  }
  flushTools()
  return result
}

interface Props {
  channelId: string
  messages: ChatMessage[]
  stream?: StreamState
  streams?: StreamState[]
  agentLoop?: AgentLoopState
  agentLoops?: AgentLoopState[]
  members?: ChannelMemberInfo[]
  typing?: string
  typings?: string[]
  onQuote?: (message: ChatMessage) => void
  onMentionClick?: (name: string) => void
  currentUserId?: string
  onSubmitAnswer?: (askId: string, answers: Record<string, unknown>) => void
  onStopAgent?: (agentId: string, reason?: string) => void
  welcomeMessage?: string
  className?: string
}

function findAgentLoopAnchorMsgId(messages: ChatMessage[], loop?: AgentLoopState): number | undefined {
  if (!loop || loop.status !== 'completed') return undefined
  const startedAt = loop.startedAt - 1000
  const completedAt = (loop.completedAt ?? Number.MAX_SAFE_INTEGER) + 10_000
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!message?.msgId || message.role !== 'assistant') continue
    if (message.senderId !== loop.agentId) continue
    if (loop.finalContent && message.content !== loop.finalContent) continue
    return message.msgId
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!message?.msgId || message.role !== 'assistant') continue
    if (message.senderId !== loop.agentId) continue
    if (message.timestamp < startedAt || message.timestamp > completedAt) continue
    return message.msgId
  }
  return undefined
}

function agentLoopActivityAt(loop: AgentLoopState): number {
  let latest = loop.completedAt ?? loop.startedAt ?? 0
  for (const turn of loop.turns) {
    latest = Math.max(latest, turn.completedAt ?? turn.startedAt ?? 0)
    for (const tool of turn.toolCalls) {
      latest = Math.max(latest, tool.completedAt ?? tool.startedAt ?? 0)
    }
  }
  return latest
}

function agentLoopKey(loop: AgentLoopState): string {
  return `${loop.agentId}:${loop.startedAt}`
}

function isStreamLoop(loop?: AgentLoopState): boolean {
  return !!loop && loop.status === 'running'
}

function agentDisplayName(members: ChannelMemberInfo[] | undefined, agentId: string) {
  const member = members?.find((m) => m.agent_id === agentId)
  return member?.display_name || agentId
}

function AgentLoopBlock({ loop, members }: { loop: AgentLoopState; members?: ChannelMemberInfo[] }) {
  const agentName = agentDisplayName(members, loop.agentId)
  return (
    <div className="flex gap-2.5 py-2.5">
      <div className="w-9 shrink-0" />
      <div className="flex-1 min-w-0 rounded-md border border-[#eeeeee] bg-[#fbfbfb] px-3 py-2">
        <div className="text-xs text-[#777169] mb-1">{agentName}</div>
        <AgentLoopTimeline loop={loop} />
      </div>
    </div>
  )
}

export function MessageList({
  channelId,
  messages,
  stream,
  streams,
  agentLoop,
  agentLoops,
  members,
  typing,
  typings,
  onQuote,
  onMentionClick,
  currentUserId,
  onSubmitAnswer,
  onStopAgent,
  welcomeMessage,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const grouped = useMemo(() => groupMessages(messages), [messages])
  const visibleLoops = useMemo(() => agentLoops ?? (agentLoop ? [agentLoop] : []), [agentLoop, agentLoops])
  const visibleStreams = useMemo(() => (
    (streams ?? (stream ? [stream] : []))
      .filter((activeStream) => {
        if (activeStream.agentLoop?.status === 'completed' && activeStream.agentLoop.finalContent) return false
        return true
      })
  ), [stream, streams])
  const visibleTypings = useMemo(() => typings ?? (typing ? [typing] : []), [typing, typings])
  const loopAnchors = useMemo(() => {
    const anchors = new Map<number, AgentLoopState[]>()
    for (const loop of visibleLoops) {
      const msgId = findAgentLoopAnchorMsgId(messages, loop)
      if (!msgId) continue
      anchors.set(msgId, [...(anchors.get(msgId) ?? []), loop])
    }
    for (const [msgId, loops] of anchors) {
      loops.sort((a, b) => agentLoopActivityAt(a) - agentLoopActivityAt(b))
      anchors.set(msgId, loops)
    }
    return anchors
  }, [messages, visibleLoops])
  const anchoredLoopIds = useMemo(() => {
    const ids = new Set<string>()
    for (const loops of loopAnchors.values()) {
      for (const loop of loops) {
        ids.add(agentLoopKey(loop))
      }
    }
    return ids
  }, [loopAnchors])
  const streamAgentIds = useMemo(() => new Set(visibleStreams.map((s) => s.agentId)), [visibleStreams])
  const standaloneLoops = useMemo(() => (
    visibleLoops
      .filter((loop) => !anchoredLoopIds.has(agentLoopKey(loop)))
      .filter((loop) => !streamAgentIds.has(loop.agentId))
      .filter((loop) => loop.status !== 'completed' || !loop.finalContent)
      .sort((a, b) => agentLoopActivityAt(a) - agentLoopActivityAt(b))
  ), [anchoredLoopIds, streamAgentIds, visibleLoops])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (el) { el.scrollTop = el.scrollHeight }
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current) { scrollToBottom(); requestAnimationFrame(scrollToBottom) }
  }, [messages.length, visibleStreams.map((s) => s.content).join(''), visibleTypings.join('|'), scrollToBottom])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  const handleScrollToMessage = useCallback((msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-yellow-50')
      setTimeout(() => el.classList.remove('bg-yellow-50'), 1500)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#fafafa]"
    >
      <div className="mx-auto w-full" style={{ maxWidth: CHAT_MAX_WIDTH }}>
        {messages.length === 0 && visibleStreams.length === 0 && standaloneLoops.length === 0 && visibleTypings.length === 0 && (
          <div className="flex min-h-[calc(100dvh-190px)] items-center justify-center px-6 text-center">
            <p className="max-w-md rounded-xl border border-border bg-white px-6 py-5 text-sm leading-6 text-muted-foreground shadow-sm">{welcomeMessage}</p>
          </div>
        )}

        {messages.length > 0 && (
          <div className="flex flex-col justify-end min-h-full px-4 py-3 gap-1 overflow-x-hidden max-w-full">
            {grouped.map((item, i) => {
              if (Array.isArray(item)) {
                return <ToolGroupBubble key={`tg-${i}`} messages={item} />
              }
              return (
                <div key={item.msgId ?? `m-${i}`}>
                  {item.msgId && loopAnchors.get(item.msgId)?.map((loop) => (
                    <AgentLoopBlock key={`loop-${loop.agentId}-${loop.startedAt}`} loop={loop} members={members} />
                  ))}
                  <MessageBubble
                    message={item}
                    isOwn={item.role === 'user'}
                    channelId={channelId}
                    currentUserId={currentUserId}
                    onQuote={onQuote}
                    onMentionClick={onMentionClick}
                    onScrollToMessage={handleScrollToMessage}
                    onSubmitAnswer={onSubmitAnswer}
                  />
                </div>
              )
            })}
          </div>
        )}

        {standaloneLoops.map((loop) => (
          <AgentLoopBlock key={`standalone-loop-${loop.agentId}-${loop.startedAt}`} loop={loop} members={members} />
        ))}

        {/* Streaming */}
        {visibleStreams.map((activeStream) => {
          const activeLoop = activeStream.agentLoop ?? visibleLoops.find((loop) => loop.agentId === activeStream.agentId && isStreamLoop(loop))
          const agent = members?.find(m => m.agent_id === activeStream.agentId)
          return (
            <div key={`stream-${activeStream.agentId}`} className="px-4 pb-3 mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
              <StreamRenderer
                stream={activeStream}
                agentLoop={activeLoop}
                agentAvatarUrl={agent?.avatar_url}
                agentDisplayName={agent?.display_name}
                onStop={onStopAgent}
              />
            </div>
          )
        })}

        {/* Typing indicator */}
        {visibleTypings.length > 0 && visibleStreams.length === 0 && visibleTypings.map((text, i) => (
          <div key={`typing-${i}-${text}`} className="flex items-center gap-2 px-16 py-2 text-[#999] text-xs mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#999] [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#999] [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#999] [animation-delay:300ms]" />
            </span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
