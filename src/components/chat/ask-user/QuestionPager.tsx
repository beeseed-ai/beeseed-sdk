import { cn } from '../../../lib/cn.js'

interface Props {
  total: number
  current: number
  onPageChange: (page: number) => void
}

export function QuestionPager({ total, current, onPageChange }: Props) {
  if (total <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, current - 1))}
        disabled={current === 0}
        className={cn(
          'inline-flex h-9 min-w-20 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors',
          current === 0
            ? 'border-transparent bg-transparent text-muted-foreground/35 cursor-not-allowed'
            : 'border-border bg-background text-foreground hover:bg-muted',
        )}
      >
        上一题
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`第 ${i + 1} 题`}
              onClick={() => onPageChange(i)}
              className={cn(
                'size-4 rounded-full border transition-all',
                i === current
                  ? 'border-primary bg-primary shadow-[0_0_0_3px_rgba(24,29,38,0.10)]'
                  : 'border-muted-foreground/30 bg-background hover:border-muted-foreground/60',
              )}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {current + 1}/{total}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(total - 1, current + 1))}
        disabled={current === total - 1}
        className={cn(
          'inline-flex h-9 min-w-20 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors',
          current === total - 1
            ? 'border-transparent bg-transparent text-muted-foreground/35 cursor-not-allowed'
            : 'border-border bg-background text-foreground hover:bg-muted',
        )}
      >
        下一题
      </button>
    </div>
  )
}
