import { useState, useCallback } from 'react'
import type { ChatMessage } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useChat } from '../../hooks/use-chat.js'
import { MessageList } from './MessageList.js'
import { MessageInput } from './MessageInput.js'

const CHAT_MAX_WIDTH = 820

interface Props {
  roomId: string
  className?: string
  header?: React.ReactNode
}

export function ChatRoom({ roomId, className, header }: Props) {
  const { user } = useAuth()
  const { messages, stream, agentLoop, members, typing, send, sendWithQuote, submitAnswer, stopAgent, loading } = useChat(roomId)
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null)

  const handleSend = useCallback((content: string) => {
    if (quotedMessage) {
      sendWithQuote(content, quotedMessage)
      setQuotedMessage(null)
    } else {
      send(content)
    }
  }, [quotedMessage, send, sendWithQuote])

  return (
    <div className={cn('flex h-full flex-col bg-white', className)}>
      {header}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-[#777169]">加载消息中...</span>
        </div>
      ) : (
        <MessageList
          messages={messages}
          stream={stream}
          agentLoop={agentLoop}
          members={members}
          typing={typing}
          onQuote={setQuotedMessage}
          currentUserId={user?.id}
          onSubmitAnswer={submitAnswer}
          onStopAgent={stopAgent}
        />
      )}

      {/* Input area — centered at max-width */}
      <div className="shrink-0 mx-auto w-full" style={{ maxWidth: CHAT_MAX_WIDTH }}>
        <MessageInput
          onSend={handleSend}
          members={members}
          quotedMessage={quotedMessage}
          onClearQuote={() => setQuotedMessage(null)}
        />
      </div>
    </div>
  )
}
