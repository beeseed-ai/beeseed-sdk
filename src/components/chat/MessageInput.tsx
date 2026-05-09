import { useRef, useCallback, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { X, Plus, AtSign, Zap, ListChecks, Workflow, ArrowUp } from 'lucide-react'
import type { ChatMessage, RoomMemberInfo } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { MentionMenu, getFilteredCount, getFilteredMember } from './MentionMenu.js'

interface Props {
  onSend: (content: string, metadata?: Record<string, unknown>) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  members?: RoomMemberInfo[]
  quotedMessage?: ChatMessage | null
  onClearQuote?: () => void
}

export function MessageInput({
  onSend,
  disabled,
  placeholder = '输入消息...',
  className,
  members = [],
  quotedMessage,
  onClearQuote,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Mention state
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState(-1)

  const autoResize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  const insertMention = useCallback((member: RoomMemberInfo) => {
    const el = ref.current
    if (!el || mentionStart < 0) return
    const before = el.value.slice(0, mentionStart)
    const after = el.value.slice(el.selectionStart)
    const name = member.display_name
    el.value = `${before}@${name} ${after}`
    setMentionOpen(false)
    setMentionStart(-1)
    autoResize()
    el.focus()
    const cursor = before.length + name.length + 2
    el.setSelectionRange(cursor, cursor)
  }, [mentionStart, autoResize])

  const handleSend = useCallback(() => {
    const el = ref.current
    if (!el) return
    const content = el.value.trim()
    if (!content) return
    onSend(content)
    el.value = ''
    setMentionOpen(false)
    autoResize()
    el.focus()
  }, [onSend, autoResize])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen) {
        const count = getFilteredCount(members, mentionQuery)
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMentionIndex((i) => (i + 1) % Math.max(count, 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setMentionIndex((i) => (i - 1 + Math.max(count, 1)) % Math.max(count, 1))
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          const member = getFilteredMember(members, mentionQuery, mentionIndex)
          if (member) insertMention(member)
          return
        }
        if (e.key === 'Escape') {
          setMentionOpen(false)
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [mentionOpen, mentionQuery, mentionIndex, members, handleSend, insertMention],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      autoResize()
      if (members.length === 0) return

      const el = e.target
      const pos = el.selectionStart
      const text = el.value

      // Detect @ trigger
      if (pos > 0 && text[pos - 1] === '@') {
        const charBefore = pos > 1 ? text[pos - 2] : ' '
        if (charBefore === ' ' || charBefore === '\n' || pos === 1) {
          setMentionOpen(true)
          setMentionQuery('')
          setMentionIndex(0)
          setMentionStart(pos - 1)
          return
        }
      }

      if (mentionOpen && mentionStart >= 0) {
        const query = text.slice(mentionStart + 1, pos)
        if (query.includes(' ') || query.includes('\n')) {
          setMentionOpen(false)
        } else {
          setMentionQuery(query)
          setMentionIndex(0)
        }
      }
    },
    [autoResize, members.length, mentionOpen, mentionStart],
  )

  return (
    <div className={cn('border-t bg-background', className)}>
      {/* Quoted message bar */}
      {quotedMessage && (
        <div className="flex items-center gap-2 px-4 pt-2 pb-1">
          <div className="flex-1 min-w-0 border-l-2 border-primary/50 pl-2 py-0.5">
            <div className="text-[11px] font-medium text-muted-foreground">{quotedMessage.senderName || '引用'}</div>
            <div className="text-xs text-muted-foreground/70 truncate">{quotedMessage.content}</div>
          </div>
          <button onClick={onClearQuote} className="p-0.5 hover:bg-muted rounded transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      <div className="relative px-4 pt-3 pb-2">
        {/* Mention menu */}
        {mentionOpen && members.length > 0 && (
          <MentionMenu
            members={members}
            query={mentionQuery}
            selectedIndex={mentionIndex}
            onSelect={insertMention}
            onClose={() => setMentionOpen(false)}
          />
        )}

        <textarea
          ref={ref}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full resize-none rounded-xl border border-input bg-muted/30 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:opacity-50"
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-0.5">
            <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { const el = ref.current; if (el) { const pos = el.selectionStart; el.value = el.value.slice(0, pos) + '@' + el.value.slice(pos); el.setSelectionRange(pos + 1, pos + 1); el.focus(); el.dispatchEvent(new Event('input', { bubbles: true })); setMentionOpen(true); setMentionQuery(''); setMentionIndex(0); setMentionStart(pos) } }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <AtSign className="w-3.5 h-3.5" />
              <span>提及</span>
            </button>
            <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Zap className="w-3.5 h-3.5" />
              <span>技能</span>
            </button>
            <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ListChecks className="w-3.5 h-3.5" />
              <span>任务</span>
            </button>
            <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Workflow className="w-3.5 h-3.5" />
              <span>工作流</span>
            </button>
          </div>
          <button
            disabled={disabled}
            onClick={handleSend}
            className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
