import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import type { ReactNode } from 'react'

interface Props {
  title: string
  open: boolean
  onToggle: () => void
  badge?: number
  children: ReactNode
  className?: string
}

export function AccordionSection({ title, open, onToggle, badge, children, className }: Props) {
  return (
    <div className={cn('border-b border-border', className)}>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className={cn('w-3 h-3 transition-transform', open && 'rotate-90')} />
        <span className="flex-1 text-left">{title}</span>
        {badge != null && badge > 0 && (
          <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">{badge}</span>
        )}
      </button>
      {open && <div className="px-3 pb-2">{children}</div>}
    </div>
  )
}
