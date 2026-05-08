import { useEffect, useRef } from 'react'
import type { Message, StreamState } from '../../core/types.js'
import { ScrollArea } from '../ui/scroll-area.js'
import { MessageBubble } from './MessageBubble.js'
import { StreamRenderer } from './StreamRenderer.js'

interface Props {
  messages: Message[]
  stream?: StreamState
  currentUserId?: string
  className?: string
}

export function MessageList({ messages, stream, currentUserId, className }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = viewportRef.current
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }, [messages.length, stream?.content])

  return (
    <ScrollArea className={className} viewportRef={viewportRef}>
      <div className="flex flex-col py-2">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_type === 'user' && msg.sender_user_id === currentUserId}
          />
        ))}
        {stream && <StreamRenderer stream={stream} />}
      </div>
    </ScrollArea>
  )
}
