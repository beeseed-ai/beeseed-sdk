import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn.js'

interface Props {
  icon: ReactNode
  label: string
  labelClassName: string
  summary?: string
  summaryLive?: boolean
  trailing?: ReactNode
  title?: string
  /** When provided the row becomes an expandable button; otherwise it is a plain row. */
  onToggle?: () => void
  open?: boolean
}

/**
 * The status row shared by the finished-run transcript and the in-flight
 * indicator. Both states must read as one row, so they render the same element
 * tree and type scale rather than two hand-copied class lists that drift apart.
 */
export function RunStatusRow({ icon, label, labelClassName, summary, summaryLive, trailing, title, onToggle, open }: Props) {
  const shell = 'mb-1 flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md border border-[#dddddd] bg-white px-2.5 py-1.5 text-left text-xs'

  const body = (
    <>
      <ChevronRight className={cn('size-3 shrink-0 text-[#777169]', onToggle && 'transition-transform', open && 'rotate-90')} />
      {icon}
      <span className={cn('shrink-0 font-medium', labelClassName)}>{label}</span>
      {summary && (
        <span
          className="min-w-0 flex-1 truncate text-[#555]"
          aria-live={summaryLive ? 'polite' : undefined}
          aria-atomic={summaryLive ? 'true' : undefined}
        >
          {summary}
        </span>
      )}
      {trailing}
    </>
  )

  if (!onToggle) return <div className={shell}>{body}</div>

  return (
    <button
      type="button"
      aria-expanded={!!open}
      title={title}
      onClick={onToggle}
      className={cn(shell, 'transition-colors hover:bg-[#f8fafc]')}
    >
      {body}
    </button>
  )
}
