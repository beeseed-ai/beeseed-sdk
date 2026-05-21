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
  const confirmPrimary = value !== false
  const cancelPrimary = value === false

  return (
    <div className="flex gap-3">
      <button
        disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(
          'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all',
          confirmPrimary
            ? 'border-[#181d26] bg-[#181d26] text-white hover:bg-[#0d1218]'
            : 'border-[#dddddd] bg-white text-[#181d26] hover:bg-[#f8fafc]',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {confirmText}
      </button>
      <button
        disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(
          'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all',
          cancelPrimary
            ? 'border-[#181d26] bg-[#181d26] text-white hover:bg-[#0d1218]'
            : 'border-[#dddddd] bg-white text-[#181d26] hover:bg-[#f8fafc]',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {cancelText}
      </button>
    </div>
  )
}
