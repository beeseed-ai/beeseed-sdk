import { cn } from '../../lib/cn.js'

interface Props {
  quote: { msgId?: number; senderName?: string; content: string }
  className?: string
  onScrollTo?: (msgId: number) => void
}

export function QuotedMessageBlock({ quote, className, onScrollTo }: Props) {
  return (
    <div
      className={cn(
        'border-l-2 border-muted-foreground/30 pl-2.5 py-0.5 mb-1 cursor-pointer hover:bg-muted/30 rounded-r-md transition-colors',
        className,
      )}
      onClick={() => {
        if (quote.msgId && onScrollTo) onScrollTo(quote.msgId)
      }}
    >
      {quote.senderName && (
        <div className="text-[11px] font-medium text-muted-foreground mb-0.5">{quote.senderName}</div>
      )}
      <div className="text-xs text-muted-foreground/80 line-clamp-2 whitespace-pre-wrap">
        {quote.content}
      </div>
    </div>
  )
}
