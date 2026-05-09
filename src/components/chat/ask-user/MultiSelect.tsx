import type { AskUserQuestion } from '../../../core/types.js'
import { cn } from '../../../lib/cn.js'

interface Props {
  question: AskUserQuestion
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function MultiSelect({ question, value, onChange, disabled }: Props) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="space-y-2">
      {question.options?.map((opt) => {
        const selected = value.includes(opt.id)
        return (
          <button
            key={opt.id}
            disabled={disabled}
            onClick={() => toggle(opt.id)}
            className={cn(
              'w-full text-left rounded-lg border px-3 py-2.5 transition-all',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background hover:border-primary/50 hover:bg-muted',
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                selected ? 'border-primary bg-primary' : 'border-muted-foreground/30',
              )}>
                {selected && (
                  <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{opt.label}</div>
                {opt.description && <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
