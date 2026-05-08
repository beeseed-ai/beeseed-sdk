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
  const { messages, stream, typing, send, loading } = useChat(roomId)

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
          currentUserId={user?.id}
        />
      )}

      <TypingIndicator text={typing} />
      <MessageInput onSend={send} />
    </div>
  )
}
