import type { AskUserQuestion } from '../../../core/types.js'
import { cn } from '../../../lib/cn.js'

interface Props {
  question: AskUserQuestion
  value: string
  onChange: (text: string) => void
  disabled?: boolean
}

export function TextInput({ question, value, onChange, disabled }: Props) {
  const base = cn(
    'w-full rounded-lg border border-border bg-background text-foreground text-sm',
    'px-3 py-2 placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors',
    disabled && 'opacity-60 cursor-not-allowed',
  )

  if (question.multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder || ''}
        disabled={disabled}
        rows={4}
        className={cn(base, 'resize-y min-h-[80px]')}
      />
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder || ''}
      disabled={disabled}
      className={base}
    />
  )
}
