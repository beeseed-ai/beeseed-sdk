import type { AskUserQuestion } from '../../../core/types.js'
import { cn } from '../../../lib/cn.js'

interface Props {
  question: AskUserQuestion
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function ImageGrid({ question, value, onChange, disabled }: Props) {
  const columns = question.columns || 3
  const maxSelect = question.max_select || 0

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else if (maxSelect > 0 && value.length >= maxSelect) {
      onChange([...value.slice(1), id])
    } else {
      onChange([...value, id])
    }
  }

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {question.options?.map((opt) => {
        const selected = value.includes(opt.id)
        return (
          <button
            key={opt.id}
            disabled={disabled}
            onClick={() => toggle(opt.id)}
            className={cn(
              'relative rounded-lg border-2 overflow-hidden transition-all',
              selected
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-transparent hover:border-primary/30',
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          >
            {opt.image_url ? (
              <img src={opt.image_url} alt={opt.label} className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground text-xs">
                {opt.label}
              </div>
            )}
            <div className="px-2 py-1.5 bg-muted text-xs text-muted-foreground truncate text-center">
              {opt.label}
            </div>
            {selected && (
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
