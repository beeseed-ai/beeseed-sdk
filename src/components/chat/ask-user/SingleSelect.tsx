import { useId, useState } from 'react'
import type { AskUserQuestion } from '../../../core/types.js'
import { cn } from '../../../lib/cn.js'

interface Props {
  question: AskUserQuestion
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}

export function SingleSelect({ question, value, onChange, disabled }: Props) {
  const customInputId = useId()
  const optionIds = new Set(question.options?.map((option) => option.id) ?? [])
  const [customOpen, setCustomOpen] = useState(
    () => question.allow_free_text === true && value !== null && !optionIds.has(value),
  )

  return (
    <div className="space-y-2">
      {question.options?.map((opt) => (
        <button
          type="button"
          key={opt.id}
          disabled={disabled}
          onClick={() => {
            setCustomOpen(false)
            onChange(opt.id)
          }}
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
      {question.allow_free_text && (
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCustomOpen(true)
              if (optionIds.has(value ?? '')) onChange(null)
            }}
            className={cn(
              'w-full rounded-lg border px-3 py-2.5 text-left transition-all',
              customOpen
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background hover:border-primary/50 hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                customOpen ? 'border-primary' : 'border-muted-foreground/30',
              )}>
                {customOpen && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div className="text-sm font-medium">自定义填写</div>
            </div>
          </button>
          {customOpen && (
            <div className="space-y-1.5 pl-7">
              <label htmlFor={customInputId} className="block text-xs font-medium text-muted-foreground">
                补充你的具体要求
              </label>
              <textarea
                id={customInputId}
                autoFocus={!disabled}
                disabled={disabled}
                rows={3}
                value={typeof value === 'string' && !optionIds.has(value) ? value : ''}
                onChange={(event) => onChange(event.target.value)}
                placeholder="例如：改为两页，并调整为更简洁的配色"
                className={cn(
                  'min-h-20 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
