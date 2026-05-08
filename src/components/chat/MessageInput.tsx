import { useRef, useCallback, type KeyboardEvent } from 'react'
import { SendHorizonal } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { Button } from '../ui/button.js'

interface Props {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function MessageInput({ onSend, disabled, placeholder = '输入消息...', className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const autoResize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  const handleSend = useCallback(() => {
    const el = ref.current
    if (!el) return
    const content = el.value.trim()
    if (!content) return
    onSend(content)
    el.value = ''
    autoResize()
    el.focus()
  }, [onSend, autoResize])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className={cn('flex items-end gap-2 border-t bg-background px-4 py-3', className)}>
      <textarea
        ref={ref}
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        onInput={autoResize}
        onKeyDown={handleKeyDown}
      />
      <Button size="icon" disabled={disabled} onClick={handleSend}>
        <SendHorizonal className="size-4" />
      </Button>
    </div>
  )
}
