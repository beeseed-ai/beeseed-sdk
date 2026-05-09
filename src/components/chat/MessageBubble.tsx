import { useState, useCallback } from 'react'
import { Copy, Check, Quote } from 'lucide-react'
import type { ChatMessage } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { formatTime } from '../../lib/format.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import { ThinkingBlock } from './ThinkingBlock.js'
import { QuotedMessageBlock } from './QuotedMessageBlock.js'
import { ImagePreview } from './ImagePreview.js'
import { AskUserCard } from './AskUserCard.js'

interface Props {
  message: ChatMessage
  isOwn: boolean
  currentUserId?: string
  onQuote?: (message: ChatMessage) => void
  onMentionClick?: (name: string) => void
  onScrollToMessage?: (msgId: number) => void
  onSubmitAnswer?: (askId: string, answers: Record<string, unknown>) => void
  className?: string
}

const SYSTEM_COLORS: Record<string, string> = {
  task_scheduler: 'bg-purple-100 text-purple-700',
  task_plan_created: 'bg-purple-100 text-purple-700',
  warning: 'bg-orange-100 text-orange-700',
  error: 'bg-red-100 text-red-700',
  agent_offline: 'bg-orange-100 text-orange-700',
  timeout: 'bg-orange-100 text-orange-700',
  start_failed: 'bg-orange-100 text-orange-700',
  retry: 'bg-blue-100 text-blue-700',
}

export function MessageBubble({
  message,
  isOwn,
  currentUserId,
  onQuote,
  onMentionClick,
  onScrollToMessage,
  onSubmitAnswer,
  className,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  // System messages
  if (message.role === 'system') {
    const colorClass = message.systemSource
      ? (SYSTEM_COLORS[message.systemSource] ?? 'bg-muted text-muted-foreground')
      : 'bg-muted text-muted-foreground'
    return (
      <div className={cn('flex justify-center py-1', className)} id={message.msgId ? `msg-${message.msgId}` : undefined}>
        <span className={cn('text-xs rounded-full px-3 py-1', colorClass)}>
          {message.content}
        </span>
      </div>
    )
  }

  // Ask-User interactive card
  if (message.askUserData) {
    return (
      <AskUserCard
        data={message.askUserData}
        currentUserId={currentUserId}
        onSubmit={(answers) => {
          if (message.askUserData?.askId && onSubmitAnswer) {
            onSubmitAnswer(message.askUserData.askId, answers)
          }
        }}
        className={className}
      />
    )
  }

  // Tool messages are rendered by ToolGroupBubble at the MessageList level
  if (message.role === 'tool') {
    return (
      <div className={cn('px-4 py-0.5', className)} id={message.msgId ? `msg-${message.msgId}` : undefined}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            message.toolKind === 'call' ? 'bg-yellow-400' :
            message.toolSuccess ? 'bg-green-500' : 'bg-red-500',
          )} />
          <span className="font-mono">{message.toolName}</span>
          {message.toolKind === 'result' && (
            <span>{message.toolSuccess ? '成功' : '失败'}</span>
          )}
        </div>
      </div>
    )
  }

  const isAgent = message.isAgent || message.role === 'assistant'
  const isImage = message.contentType === 'image'

  const senderName = isOwn
    ? '你'
    : message.senderName || (isAgent ? 'Agent' : '用户')

  return (
    <div
      className={cn('group flex gap-2 px-4 py-1', isOwn && 'flex-row-reverse', className)}
      id={message.msgId ? `msg-${message.msgId}` : undefined}
    >
      {/* Avatar */}
      {!isOwn && (
        <Avatar className="size-7 shrink-0 mt-0.5">
          {message.senderAvatarUrl ? (
            <AvatarImage src={message.senderAvatarUrl} />
          ) : null}
          <AvatarFallback className="text-xs">
            {isAgent ? '🤖' : senderName[0]}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col gap-0.5', isOwn ? 'items-end max-w-[75%]' : 'max-w-[85%]')}>
        {/* Sender name */}
        {!isOwn && (
          <span className="text-xs text-muted-foreground">{senderName}</span>
        )}

        {/* Quoted message */}
        {message.quotedMessage && (
          <QuotedMessageBlock quote={message.quotedMessage} onScrollTo={onScrollToMessage} />
        )}

        {/* Thinking */}
        {message.thinkingContent && (
          <ThinkingBlock content={message.thinkingContent} />
        )}

        {/* Content */}
        {isImage ? (
          <img
            src={message.content}
            alt="image"
            className="max-w-[260px] max-h-[200px] object-cover rounded-lg cursor-pointer"
            onClick={() => setPreviewImage(message.content)}
          />
        ) : isOwn ? (
          <div className="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words bg-primary text-primary-foreground">
            {message.content}
          </div>
        ) : (
          <div className="rounded-lg px-3 py-2 text-sm break-words bg-muted text-foreground">
            <MarkdownRenderer
              content={message.content}
              onMentionClick={onMentionClick}
            />
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                className="text-xs px-2.5 py-1 rounded-full border border-muted-foreground/20 hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp + hover actions */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {formatTime(new Date(message.timestamp).toISOString())}
          </span>

          {/* Hover actions for agent/other messages */}
          {!isOwn && message.content && (
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                onClick={handleCopy}
                className="p-0.5 rounded hover:bg-muted-foreground/10 transition-colors"
                title="复制"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground" />
                )}
              </button>
              {onQuote && (
                <button
                  onClick={() => onQuote(message)}
                  className="p-0.5 rounded hover:bg-muted-foreground/10 transition-colors"
                  title="引用"
                >
                  <Quote className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image preview overlay */}
      {previewImage && (
        <ImagePreview src={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </div>
  )
}
