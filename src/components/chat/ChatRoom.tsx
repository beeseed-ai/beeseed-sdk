import { useState, useCallback } from 'react'
import type { ChatMessage } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useChat } from '../../hooks/use-chat.js'
import { MessageList } from './MessageList.js'
import { MessageInput } from './MessageInput.js'
import { TypingIndicator } from './TypingIndicator.js'

interface Props {
  roomId: string
  className?: string
  header?: React.ReactNode
}

export function ChatRoom({ roomId, className, header }: Props) {
  const { user } = useAuth()
  const { messages, stream, agentLoop, members, typing, send, sendWithQuote, submitAnswer, loading } = useChat(roomId)
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null)

  const handleSend = useCallback((content: string) => {
    if (quotedMessage) {
      sendWithQuote(content, quotedMessage)
      setQuotedMessage(null)
    } else {
      send(content)
    }
  }, [quotedMessage, send, sendWithQuote])

  const handleQuote = useCallback((msg: ChatMessage) => {
    setQuotedMessage(msg)
  }, [])

  const handleSubmitAnswer = useCallback((askId: string, answers: Record<string, unknown>) => {
    submitAnswer(askId, answers)
  }, [submitAnswer])

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {header}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">加载中...</span>
        </div>
      ) : (
        <MessageList
          className="flex-1"
          messages={messages}
          stream={stream}
          agentLoop={agentLoop}
          onQuote={handleQuote}
          currentUserId={user?.id}
          onSubmitAnswer={handleSubmitAnswer}
        />
      )}

      <TypingIndicator text={typing} />
      <MessageInput
        onSend={handleSend}
        members={members}
        quotedMessage={quotedMessage}
        onClearQuote={() => setQuotedMessage(null)}
      />
    </div>
  )
}
