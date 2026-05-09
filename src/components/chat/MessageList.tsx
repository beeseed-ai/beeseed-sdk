import { useEffect, useRef, useMemo, useCallback } from 'react'
import type { ChatMessage, StreamState, AgentLoopState } from '../../core/types.js'
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
  onQuote?: (message: ChatMessage) => void
  onMentionClick?: (name: string) => void
  currentUserId?: string
  onSubmitAnswer?: (askId: string, answers: Record<string, unknown>) => void
  className?: string
}

export function MessageList({ messages, stream, agentLoop, onQuote, onMentionClick, currentUserId, onSubmitAnswer }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const grouped = useMemo(() => groupMessages(messages), [messages])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (el) { el.scrollTop = el.scrollHeight }
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current) { scrollToBottom(); requestAnimationFrame(scrollToBottom) }
  }, [messages.length, stream?.content, scrollToBottom])

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
                <MessageBubble
                  key={item.msgId ?? `m-${i}`}
                  message={item}
                  isOwn={item.role === 'user'}
                  currentUserId={currentUserId}
                  onQuote={onQuote}
                  onMentionClick={onMentionClick}
                  onScrollToMessage={handleScrollToMessage}
                  onSubmitAnswer={onSubmitAnswer}
                />
              )
            })}
          </div>
        )}

        {/* Completed Agent Loop */}
        {agentLoop && agentLoop.status !== 'running' && !stream && (
          <div className="flex gap-2.5 px-4 py-2.5 mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
            <div className="shrink-0 mt-0.5">
              <div className="w-9 h-9 rounded-full bg-[#F59E0B] flex items-center justify-center text-white text-xs font-medium">A</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#777169] mb-1">{agentLoop.agentId}</div>
              <AgentLoopTimeline loop={agentLoop} />
            </div>
          </div>
        )}

        {/* Streaming */}
        {stream && (
          <div className="px-4 pb-3 mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
            <StreamRenderer stream={stream} agentLoop={agentLoop} />
          </div>
        )}

        {/* Streaming dots indicator */}
        {stream && !stream.content && !stream.thinking && !stream.toolCall && (
          <div className="flex items-center gap-2 px-16 py-2 text-[#777169] mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#777169] [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#777169] [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#777169] [animation-delay:300ms]" />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
