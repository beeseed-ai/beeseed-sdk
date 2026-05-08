import type { Message } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { formatTime } from '../../lib/format.js'
import { Avatar, AvatarFallback } from '../ui/avatar.js'

interface Props {
  message: Message
  isOwn: boolean
}

export function MessageBubble({ message, isOwn }: Props) {
  const isAgent = message.sender_type === 'agent'
  const isSystem = message.sender_type === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
          {message.content}
        </span>
      </div>
    )
  }

  const senderName = isOwn
    ? '你'
    : isAgent
      ? (message.sender_agent_id || 'Agent')
      : '用户'

  return (
    <div className={cn('flex gap-2 px-4 py-1', isOwn && 'flex-row-reverse')}>
      {!isOwn && (
        <Avatar className="size-7 shrink-0 mt-0.5">
          <AvatarFallback className="text-xs">
            {isAgent ? '🤖' : senderName[0]}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col gap-0.5 max-w-[75%]', isOwn && 'items-end')}>
        {!isOwn && (
          <span className="text-xs text-muted-foreground">{senderName}</span>
        )}
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
            isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground',
          )}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  )
}
