import { cn } from '../../../lib/cn.js'

interface Props {
  total: number
  current: number
  onPageChange: (page: number) => void
}

export function QuestionPager({ total, current, onPageChange }: Props) {
  if (total <= 1) return null

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        onClick={() => onPageChange(Math.max(0, current - 1))}
        disabled={current === 0}
        className={cn(
          'text-xs px-2 py-1 rounded transition-colors',
          current === 0 ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
      >
        ‹
      </button>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            onClick={() => onPageChange(i)}
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              i === current ? 'bg-primary scale-125' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50',
            )}
          />
        ))}
      </div>
      <button
        onClick={() => onPageChange(Math.min(total - 1, current + 1))}
        disabled={current === total - 1}
        className={cn(
          'text-xs px-2 py-1 rounded transition-colors',
          current === total - 1 ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
      >
        ›
      </button>
    </div>
  )
}
