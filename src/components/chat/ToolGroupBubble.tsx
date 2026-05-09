import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ChatMessage } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'

interface Props {
  messages: ChatMessage[]
  className?: string
}

function formatToolArgs(args?: Record<string, unknown>): Record<string, unknown> | null {
  if (!args) return null
  const filtered: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (k.startsWith('_') || k === 'hint') continue
    if (v === null || v === undefined || v === '') continue
    filtered[k] = v
  }
  return Object.keys(filtered).length > 0 ? filtered : null
}

function truncateValue(v: unknown, maxLen = 120): string {
  if (typeof v === 'string') {
    const oneLine = v.replace(/\n/g, '↵').replace(/\r/g, '')
    return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '…' : oneLine
  }
  const s = JSON.stringify(v)
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
}

function ToolLine({ message }: { message: ChatMessage }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const isCall = message.toolKind === 'call'
  const name = message.toolName || 'unknown'
  const status = isCall ? '调用中' : message.toolSuccess ? '完成' : '失败'

  const dotColor = isCall
    ? 'bg-yellow-500'
    : message.toolSuccess
    ? 'bg-green-500'
    : 'bg-red-500'

  const hint = isCall ? message.content : ''
  const args = isCall ? formatToolArgs(message.toolArgs) : null
  const resultOutput = !isCall && message.content ? message.content : null
  const hasDetail = !!args || !!resultOutput

  return (
    <div className="py-0.5">
      <div
        className={cn(
          'flex items-center gap-2 text-xs text-muted-foreground',
          hasDetail && 'cursor-pointer hover:bg-muted/50 -mx-1 px-1 rounded',
        )}
        onClick={hasDetail ? () => setDetailOpen(!detailOpen) : undefined}
      >
        {hasDetail ? (
          <ChevronRight className={cn('w-3 h-3 shrink-0 transition-transform', detailOpen && 'rotate-90')} />
        ) : (
          <span className="w-3 h-3" />
        )}
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />
        <span className="font-mono text-foreground">{name}</span>
        <span>{status}</span>
        {hint && !detailOpen && <span className="truncate max-w-[200px] opacity-60">{hint}</span>}
        {message.toolDuration != null && (
          <span className="opacity-50">{message.toolDuration.toFixed(1)}s</span>
        )}
      </div>

      {detailOpen && (
        <div className="ml-5 mt-1 mb-1 text-[11px] border-l-2 border-muted pl-2">
          {args && (
            <div className="space-y-0.5">
              {Object.entries(args).map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <span className="text-muted-foreground shrink-0">{k}:</span>
                  <span className="text-foreground break-all font-mono whitespace-pre-wrap">{truncateValue(v, 300)}</span>
                </div>
              ))}
            </div>
          )}
          {resultOutput && (
            <pre className="text-foreground whitespace-pre-wrap break-all font-mono max-h-[200px] overflow-y-auto text-[11px]">
              {resultOutput.length > 2000 ? resultOutput.slice(0, 2000) + '\n…(truncated)' : resultOutput}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export function ToolGroupBubble({ messages, className }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (messages.length === 0) return null

  const sender = messages.find(m => m.senderName)
  const senderName = sender?.senderName || 'Agent'
  const senderAvatarUrl = sender?.senderAvatarUrl

  const showAll = expanded || messages.length <= 1
  const displayMessages = showAll ? messages : [messages[messages.length - 1]!]

  return (
    <div className={cn('flex gap-2 px-4 py-1', className)}>
      <Avatar className="size-7 shrink-0 mt-0.5">
        {senderAvatarUrl ? <AvatarImage src={senderAvatarUrl} /> : null}
        <AvatarFallback className="text-xs">🤖</AvatarFallback>
      </Avatar>

      <div className="flex flex-col max-w-[85%] items-start">
        <span className="text-xs text-muted-foreground mb-0.5">{senderName}</span>
        <div className="rounded-lg bg-muted px-3 py-2 min-w-[200px]">
          {!showAll && messages.length > 1 && (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mb-0.5 transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
              <span>展开 {messages.length - 1} 条工具调用</span>
            </button>
          )}
          {showAll && messages.length > 1 && (
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mb-0.5 transition-colors"
            >
              <ChevronDown className="w-3 h-3 rotate-180" />
              <span>收起</span>
            </button>
          )}
          {displayMessages.map((msg, i) => (
            <ToolLine key={i} message={msg} />
          ))}
        </div>
      </div>
    </div>
  )
}
