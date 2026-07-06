import { useState } from 'react'
import { cn } from '../../lib/cn.js'

interface Props {
  content: string
  isStreaming?: boolean
  className?: string
}

export function ThinkingBlock({ content, isStreaming, className }: Props) {
  const [open, setOpen] = useState(false)

  if (!content && !isStreaming) return null

  return (
    <div className={cn('my-1', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isStreaming ? (
          <span className="inline-block w-3 h-3 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin" />
        ) : (
          <span className={cn('transition-transform text-[10px]', open && 'rotate-90')}>▶</span>
        )}
        <span>思考过程</span>
        {!open && content && (
          <span className="text-muted-foreground/60 truncate max-w-[200px]">
            — {content.slice(0, 60)}...
          </span>
        )}
      </button>
      {open && content && (
        <div className="mt-1 ml-4.5 max-h-[200px] overflow-y-auto rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {content}
          {isStreaming && (
            <span className="inline-block w-1 h-3 bg-muted-foreground/40 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      )}
    </div>
  )
}
