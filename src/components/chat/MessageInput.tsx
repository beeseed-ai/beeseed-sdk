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
  onImageSelect?: (file: File) => void
}

export function MessageInput({
  onSend,
  disabled,
  placeholder = '输入消息...',
  className,
  members = [],
  quotedMessage,
  onClearQuote,
  onImageSelect,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    const name = member.display_name || member.agent_id || member.user_id || 'unknown'
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

  const triggerMention = () => {
    const el = ref.current
    if (!el) return
    const pos = el.selectionStart
    el.value = el.value.slice(0, pos) + '@' + el.value.slice(pos)
    el.setSelectionRange(pos + 1, pos + 1)
    el.focus()
    el.dispatchEvent(new Event('input', { bubbles: true }))
    setMentionOpen(true)
    setMentionQuery('')
    setMentionIndex(0)
    setMentionStart(pos)
  }

  return (
    <div className={cn('shrink-0 bg-white px-3 pb-3 relative', className)}>
      {/* Unified input card — textarea + toolbar in one bordered container */}
      <div
        className="relative bg-white border border-[#e5e5e5] focus-within:border-[#d4d4d4] rounded-2xl transition-colors"
        style={{ boxShadow: '0 2.7px 8px rgba(0,0,0,0.06)' }}
      >
        {/* Mention menu — anchored above */}
        {mentionOpen && members.length > 0 && (
          <MentionMenu
            members={members}
            query={mentionQuery}
            selectedIndex={mentionIndex}
            onSelect={insertMention}
            onClose={() => setMentionOpen(false)}
          />
        )}

        {/* Quoted message inside card */}
        {quotedMessage && (
          <div className="flex items-start gap-2 px-4 pt-3 pb-1">
            <div className="flex-1 border-l-2 border-[#aaa] pl-2 min-w-0">
              <p className="text-[11px] font-medium text-[#555]">{quotedMessage.senderName || '引用'}</p>
              <p className="text-[11px] text-[#888] truncate">{quotedMessage.content.slice(0, 80)}</p>
            </div>
            <button onClick={onClearQuote} className="shrink-0 text-[#aaa] hover:text-[#555] transition-colors mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Textarea — no border, transparent */}
        <textarea
          ref={ref}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          style={{ minHeight: '46px' }}
          className="w-full resize-none bg-transparent pt-4 pb-1.5 px-[22px] text-[14px] text-black outline-none placeholder:text-[#aaaaaa]"
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
        />

        {/* Toolbar — inside the card */}
        <div className="flex items-center px-3 pb-3 gap-1">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && onImageSelect) onImageSelect(file)
                e.target.value = ''
              }}
            />
            <div className="w-px h-4 bg-[#e5e5e5] mx-1 shrink-0" />
            <button onClick={triggerMention} className="flex items-center gap-1 h-8 px-2 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors text-sm shrink-0">
              <AtSign className="w-4 h-4" />
              <span>提及</span>
            </button>
            <button className="flex items-center gap-1 h-8 px-2 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors text-sm shrink-0">
              <Zap className="w-4 h-4" />
              <span>技能</span>
            </button>
            <button className="flex items-center gap-1 h-8 px-2 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors text-sm shrink-0">
              <ListChecks className="w-4 h-4" />
              <span>任务</span>
            </button>
            <button className="flex items-center gap-1 h-8 px-2 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors text-sm shrink-0">
              <Workflow className="w-4 h-4" />
              <span>工作流</span>
            </button>
          </div>
          {/* Right side — model + send */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button className="flex items-center gap-0.5 h-8 px-2 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors text-sm shrink-0">
              <span className="text-xs">快速</span>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button
              disabled={disabled}
              onClick={handleSend}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
