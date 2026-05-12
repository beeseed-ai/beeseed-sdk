import { useState, useCallback } from 'react'
import { Copy, Check, CornerDownLeft } from 'lucide-react'
import type { ChatMessage } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
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

const AVATAR_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#6D28D9', '#059669', '#2563EB', '#DC2626']
function avatarColor(name: string): string {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!
}

const SYSTEM_COLORS: Record<string, string> = {
  task_scheduler: 'text-[#6d28d9] bg-[#ede9fe]',
  task_plan_created: 'text-[#6d28d9] bg-[#ede9fe]',
  agent_offline: 'text-[#b45309] bg-[#fef3c7]',
  agent_timeout: 'text-[#b45309] bg-[#fef3c7]',
  agent_connection_error: 'text-[#b45309] bg-[#fef3c7]',
  agent_start_failed: 'text-[#b45309] bg-[#fef3c7]',
  agent_retry: 'text-[#1e40af] bg-[#dbeafe]',
}

export function MessageBubble({
  message, currentUserId, onQuote, onMentionClick, onScrollToMessage, onSubmitAnswer, className,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  const handleQuote = useCallback(() => {
    onQuote?.(message)
  }, [message, onQuote])

  const timeStr = new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  // Ask-User card
  if (message.askUserData) {
    return (
      <AskUserCard
        data={message.askUserData}
        currentUserId={currentUserId}
        onSubmit={(answers) => {
          if (message.askUserData?.askId && onSubmitAnswer) onSubmitAnswer(message.askUserData.askId, answers)
        }}
        className={className}
      />
    )
  }

  // System messages
  if (message.role === 'system') {
    const colorClass = message.systemSource ? (SYSTEM_COLORS[message.systemSource] ?? 'text-[#777169] bg-[#f0f0f0]') : 'text-[#777169] bg-[#f0f0f0]'
    return (
      <div className={cn('flex justify-center py-1.5', className)} id={message.msgId ? `msg-${message.msgId}` : undefined}>
        <span className={cn('px-3 py-1 text-xs rounded-full text-center break-words max-w-full', colorClass)}>
          {message.content}
        </span>
      </div>
    )
  }

  // Tool messages (single fallback — grouped ones handled at MessageList level)
  if (message.role === 'tool') {
    return (
      <div className={cn('px-0 py-0.5', className)} id={message.msgId ? `msg-${message.msgId}` : undefined}>
        <div className="flex items-center gap-2 text-xs text-[#4e4e4e]">
          <span className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            message.toolKind === 'call' ? 'bg-yellow-500' : message.toolSuccess ? 'bg-green-500' : 'bg-red-500',
          )} />
          <span className="font-mono text-[#1a1a1a]">{message.toolName}</span>
          <span className="text-[#777169]">{message.toolKind === 'result' ? (message.toolSuccess ? '完成' : '失败') : '调用中'}</span>
        </div>
      </div>
    )
  }

  const isUser = message.role === 'user'
  const isImage = message.contentType === 'image'

  const senderLabel = message.senderName || (message.isAgent ? 'Agent' : '用户')

  return (
    <div
      className={cn('flex gap-2.5 py-2.5', isUser ? 'flex-row-reverse' : 'flex-row', className)}
      id={message.msgId ? `msg-${message.msgId}` : undefined}
    >
      {/* Avatar — only for non-user */}
      {!isUser && (
        <div className="shrink-0 mt-0.5">
          {message.senderAvatarUrl ? (
            <img src={message.senderAvatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: avatarColor(senderLabel) }}>
              {senderLabel.charAt(0)}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cn('group/bubble flex flex-col min-w-0 overflow-hidden', isUser ? 'max-w-[85%] md:max-w-[70%] items-end' : 'flex-1 items-start')}>
        {/* Sender name + timestamp */}
        {!isUser && (
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-xs text-[#777169]">{senderLabel}</span>
            <span className="text-[10px] text-[#999999]">{timeStr}</span>
          </div>
        )}

        {/* Message body */}
        {isImage ? (
          <img
            src={message.content}
            alt="image"
            className="max-w-[260px] max-h-[200px] object-cover rounded-lg cursor-pointer"
            onClick={() => setPreviewImage(message.content)}
          />
        ) : (
          <div className={cn(
            'relative px-3 py-2 text-base leading-relaxed overflow-hidden',
            isUser
              ? 'bg-[#f5f5f5] text-[#1a1a1a] rounded-lg rounded-tr-sm'
              : 'w-full text-[#1a1a1a]',
          )}>
            {/* Quoted message */}
            {message.quotedMessage && (
              <div
                className="mb-2 border-l-2 border-[#ccc] pl-2 py-1 cursor-pointer hover:border-[#aaa] transition-colors overflow-hidden max-h-24"
                onClick={() => { if (message.quotedMessage?.msgId && onScrollToMessage) onScrollToMessage(message.quotedMessage.msgId) }}
              >
                <span className="block text-[11px] font-medium text-[#999] mb-0.5">{message.quotedMessage.senderName || '引用'}</span>
                <div className="text-[#aaa] text-xs leading-relaxed line-clamp-3">{message.quotedMessage.content}</div>
              </div>
            )}

            {/* Thinking */}
            {message.thinkingContent && !message.isThinking && (
              <details className="mb-2 text-xs text-[#999]">
                <summary className="cursor-pointer select-none">思考过程</summary>
                <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap bg-[#f8f8f8] rounded p-2 text-[#666]">
                  {message.thinkingContent}
                </div>
              </details>
            )}

            {/* Thinking animation */}
            {message.isThinking ? (
              <div>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#777169] [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#777169] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#777169] [animation-delay:300ms]" />
                </span>
                {message.thinkingContent && (
                  <details className="mt-2 text-xs text-[#999]" open>
                    <summary className="cursor-pointer select-none">思考过程</summary>
                    <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap bg-[#f8f8f8] rounded p-2 text-[#666]">
                      {message.thinkingContent}
                    </div>
                  </details>
                )}
              </div>
            ) : isUser ? (
              <span className="whitespace-pre-wrap break-words">{message.content}</span>
            ) : (
              <MarkdownRenderer
                content={message.content}
                className="prose prose-base max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:rounded-lg [&_pre]:bg-[#f5f5f5] [&_pre]:p-3 [&_pre]:text-xs [&_code.inline-code]:rounded [&_code.inline-code]:bg-[#f5f5f5] [&_code.inline-code]:px-1.5 [&_code.inline-code]:py-0.5 [&_code.inline-code]:text-xs [&_a]:text-black [&_a]:underline [&_p]:my-2 [&_p:last-child]:mb-0 [&_p:first-child]:mt-0 [&_ul]:my-1 [&_li]:my-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_hr]:my-4 [&_hr]:border-t [&_hr]:border-[#e5e5e5] [&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:border-[#e5e5e5] [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-[#f5f5f5] [&_th]:text-left [&_td]:border [&_td]:border-[#e5e5e5] [&_td]:px-3 [&_td]:py-1.5"
                onMentionClick={onMentionClick}
              />
            )}
          </div>
        )}

        {/* Copy + Quote — text buttons, hover visible */}
        {!isUser && message.content && !message.isThinking && message.contentType !== 'image' && (
          <div className="mt-1 flex items-center gap-2 md:opacity-0 md:group-hover/bubble:opacity-100 transition-opacity">
            <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-[#999] hover:text-[#555] transition-colors">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? '已复制' : '复制'}
            </button>
            {onQuote && (
              <button onClick={handleQuote} className="flex items-center gap-1 text-[10px] text-[#999] hover:text-[#555] transition-colors">
                <CornerDownLeft className="w-3 h-3" />
                引用
              </button>
            )}
          </div>
        )}

        {/* User message timestamp + routing info */}
        {isUser && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[#999999]">{timeStr}</span>
            {message.routingInfo && (
              <span className="text-[10px] text-[#bbb] font-mono">
                → {message.routingInfo.targets.join(', ')} ({message.routingInfo.method})
              </span>
            )}
          </div>
        )}

        {/* Suggestions */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {message.suggestions.map((s, i) => (
              <button key={i} className="px-2.5 py-1 text-xs rounded-full border border-black/20 text-[#4e4e4e] hover:bg-black/5 transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {previewImage && <ImagePreview src={previewImage} onClose={() => setPreviewImage(null)} />}
    </div>
  )
}
