import { useEffect, useRef, useMemo, useCallback } from 'react'
import type { ChatMessage, StreamState, AgentLoopState } from '../../core/types.js'
import { ScrollArea } from '../ui/scroll-area.js'
import { MessageBubble } from './MessageBubble.js'
import { ToolGroupBubble } from './ToolGroupBubble.js'
import { StreamRenderer } from './StreamRenderer.js'
import { AgentLoopTimeline } from './AgentLoopTimeline.js'
import { Avatar, AvatarFallback } from '../ui/avatar.js'

type GroupedItem = ChatMessage | ChatMessage[]

function groupMessages(messages: ChatMessage[]): GroupedItem[] {
  const result: GroupedItem[] = []
  let toolBuf: ChatMessage[] = []

  const flushTools = () => {
    if (toolBuf.length > 0) {
      result.push([...toolBuf])
      toolBuf = []
    }
  }

  for (const msg of messages) {
    if (msg.role === 'tool' && msg.toolName !== 'ask_user') {
      toolBuf.push(msg)
    } else {
      flushTools()
      result.push(msg)
    }
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

export function MessageList({ messages, stream, agentLoop, onQuote, onMentionClick, currentUserId, onSubmitAnswer, className }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)

  const grouped = useMemo(() => groupMessages(messages), [messages])

  const scrollToBottom = useCallback(() => {
    const el = viewportRef.current
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, stream?.content, scrollToBottom])

  const handleScrollToMessage = useCallback((msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-yellow-100/50')
      setTimeout(() => el.classList.remove('bg-yellow-100/50'), 2000)
    }
  }, [])

  return (
    <ScrollArea className={className} viewportRef={viewportRef}>
      <div className="flex flex-col py-2">
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
        {/* Completed Agent Loop (not streaming anymore) */}
        {agentLoop && agentLoop.status !== 'running' && !stream && (
          <div className="flex gap-2 px-4 py-1">
            <Avatar className="size-7 shrink-0 mt-0.5">
              <AvatarFallback className="text-xs">🤖</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5 max-w-[85%]">
              <span className="text-xs text-muted-foreground">{agentLoop.agentId}</span>
              <div className="rounded-lg bg-muted px-3 py-2 min-w-[280px]">
                <AgentLoopTimeline loop={agentLoop} />
              </div>
            </div>
          </div>
        )}
        {stream && <StreamRenderer stream={stream} agentLoop={agentLoop} />}
      </div>
    </ScrollArea>
  )
}
