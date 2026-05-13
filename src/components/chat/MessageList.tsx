import { useEffect, useRef, useMemo, useCallback } from 'react'
import type { ChatMessage, StreamState, AgentLoopState, RoomMemberInfo } from '../../core/types.js'
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
  messages: ChatMessage[]
  stream?: StreamState
  agentLoop?: AgentLoopState
  members?: RoomMemberInfo[]
  typing?: string
  onQuote?: (message: ChatMessage) => void
  onMentionClick?: (name: string) => void
  currentUserId?: string
  onSubmitAnswer?: (askId: string, answers: Record<string, unknown>) => void
  onStopAgent?: (agentId: string, reason?: string) => void
  className?: string
}

function findAgentLoopAnchorMsgId(messages: ChatMessage[], loop?: AgentLoopState): number | undefined {
  if (!loop || loop.status !== 'completed') return undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!message?.msgId || message.role !== 'assistant') continue
    if (message.senderId !== loop.agentId) continue
    if (loop.finalContent && message.content !== loop.finalContent) continue
    return message.msgId
  }
  return undefined
}

function agentDisplay(members: RoomMemberInfo[] | undefined, agentId: string) {
  const member = members?.find((m) => m.agent_id === agentId)
  return {
    name: member?.display_name || agentId,
    avatarUrl: member?.avatar_url,
  }
}

function AgentLoopBlock({ loop, members }: { loop: AgentLoopState; members?: RoomMemberInfo[] }) {
  const agent = agentDisplay(members, loop.agentId)
  return (
    <div className="flex gap-2.5 px-4 py-2.5 mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
      <div className="shrink-0 mt-0.5">
        {agent.avatarUrl ? (
          <img src={agent.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#F59E0B] flex items-center justify-center text-white text-xs font-medium">
            {agent.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#777169] mb-1">{agent.name}</div>
        <AgentLoopTimeline loop={loop} />
      </div>
    </div>
  )
}

export function MessageList({ messages, stream, agentLoop, members, typing, onQuote, onMentionClick, currentUserId, onSubmitAnswer, onStopAgent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const grouped = useMemo(() => groupMessages(messages), [messages])
  const loopAnchorMsgId = useMemo(() => findAgentLoopAnchorMsgId(messages, agentLoop), [messages, agentLoop])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (el) { el.scrollTop = el.scrollHeight }
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current) { scrollToBottom(); requestAnimationFrame(scrollToBottom) }
  }, [messages.length, stream?.content, typing, scrollToBottom])

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
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white"
    >
      <div className="mx-auto w-full" style={{ maxWidth: CHAT_MAX_WIDTH }}>
        {messages.length > 0 && (
          <div className="flex flex-col justify-end min-h-full px-4 py-3 gap-1 overflow-x-hidden max-w-full">
            {grouped.map((item, i) => {
              if (Array.isArray(item)) {
                return <ToolGroupBubble key={`tg-${i}`} messages={item} />
              }
              return (
                <div key={item.msgId ?? `m-${i}`}>
                  {agentLoop && item.msgId === loopAnchorMsgId && (
                    <AgentLoopBlock loop={agentLoop} members={members} />
                  )}
                  <MessageBubble
                    message={item}
                    isOwn={item.role === 'user'}
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

        {/* Completed Agent Loop */}
        {agentLoop && agentLoop.status !== 'running' && !stream && !loopAnchorMsgId && (
          <AgentLoopBlock loop={agentLoop} members={members} />
        )}

        {/* Streaming */}
        {stream && (
          <div className="px-4 pb-3 mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
            <StreamRenderer
              stream={stream}
              agentLoop={agentLoop}
              agentAvatarUrl={members?.find(m => m.agent_id === stream.agentId)?.avatar_url}
              agentDisplayName={members?.find(m => m.agent_id === stream.agentId)?.display_name}
              onStop={onStopAgent}
            />
          </div>
        )}

        {/* Typing indicator */}
        {typing && !stream?.content && (
          <div className="flex items-center gap-2 px-16 py-2 text-[#999] text-xs mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#999] [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#999] [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#999] [animation-delay:300ms]" />
            </span>
            <span>{typing}</span>
          </div>
        )}
      </div>
    </div>
  )
}
