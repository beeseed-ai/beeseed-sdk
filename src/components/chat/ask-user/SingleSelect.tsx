import type { AskUserQuestion } from '../../../core/types.js'
import { cn } from '../../../lib/cn.js'

interface Props {
  question: AskUserQuestion
  value: string | null
  onChange: (id: string) => void
  disabled?: boolean
}

export function SingleSelect({ question, value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      {question.options?.map((opt) => (
        <button
          key={opt.id}
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          className={cn(
            'w-full text-left rounded-lg border px-3 py-2.5 transition-all',
            value === opt.id
              ? 'border-primary bg-primary/10'
              : 'border-border bg-background hover:border-primary/50 hover:bg-muted',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center',
              value === opt.id ? 'border-primary' : 'border-muted-foreground/30',
            )}>
              {value === opt.id && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{opt.label}</div>
              {opt.description && <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
