import { useState, useCallback } from 'react'
import type { ChatMessage } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useAppConfig } from '../../hooks/use-app-config.js'
import { useChat } from '../../hooks/use-chat.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { MessageList } from './MessageList.js'
import { MessageInput } from './MessageInput.js'

const CHAT_MAX_WIDTH = 820

interface Props {
  channelId: string
  className?: string
  header?: React.ReactNode
}

export function ChatChannel({ channelId, className, header }: Props) {
  const { user } = useAuth()
  const { branding } = useAppConfig()
  const { messages, streams, agentLoops, members, typings, send, sendWithQuote, submitAnswer, stopAgent, loading } = useChat(channelId)
  const { composerInsertText, consumeComposerInsert } = useDetailPanel()
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null)

  const handleSend = useCallback((content: string, metadata?: Record<string, unknown>) => {
    if (quotedMessage) {
      sendWithQuote(content, quotedMessage, metadata)
      setQuotedMessage(null)
    } else {
      send(content, metadata)
    }
  }, [quotedMessage, send, sendWithQuote])

  return (
    <div className={cn('flex h-full flex-col bg-[#fafafa]', className)}>
      {header}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-[#777169]">加载消息中...</span>
        </div>
      ) : (
        <MessageList
          channelId={channelId}
          messages={messages}
          streams={streams}
          agentLoops={agentLoops}
          members={members}
          typings={typings}
          onQuote={setQuotedMessage}
          currentUserId={user?.id}
          onSubmitAnswer={submitAnswer}
          onStopAgent={stopAgent}
          welcomeMessage={branding.welcomeMessage}
        />
      )}

      {/* Input area — centered at max-width */}
      <div className="mx-auto w-full shrink-0 px-4 pb-4" style={{ maxWidth: CHAT_MAX_WIDTH + 32 }}>
        <MessageInput
          channelId={channelId}
          onSend={handleSend}
          members={members}
          quotedMessage={quotedMessage}
          onClearQuote={() => setQuotedMessage(null)}
          insertText={composerInsertText}
          onInsertTextConsumed={consumeComposerInsert}
          placeholder={branding.inputPlaceholder}
        />
      </div>
    </div>
  )
}
