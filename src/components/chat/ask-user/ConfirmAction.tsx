import type { AskUserQuestion } from '../../../core/types.js'
import { cn } from '../../../lib/cn.js'

interface Props {
  question: AskUserQuestion
  value: boolean | null
  onChange: (confirmed: boolean) => void
  disabled?: boolean
}

export function ConfirmAction({ question, value, onChange, disabled }: Props) {
  const confirmText = question.confirm_text || '确认'
  const cancelText = question.cancel_text || '取消'

  return (
    <div className="flex gap-3">
      <button
        disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(
          'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
          value === true
            ? 'bg-green-600 text-white'
            : 'bg-green-600/20 text-green-600 hover:bg-green-600/40',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {confirmText}
      </button>
      <button
        disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(
          'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
          value === false
            ? 'bg-red-600 text-white'
            : 'bg-red-600/20 text-red-600 hover:bg-red-600/40',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {cancelText}
      </button>
    </div>
  )
}
