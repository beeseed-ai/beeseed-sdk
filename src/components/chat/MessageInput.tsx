import { useRef, useCallback, useEffect, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { X, Plus, AtSign, Zap, ListChecks, Workflow, ArrowUp } from 'lucide-react'
import type { ChatMessage, ChannelMemberInfo } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { fileNameFromStorageRef, storageRefFromKey } from '../../lib/storage-ref.js'
import { useStorage } from '../../hooks/use-storage.js'
import { MentionMenu, getFilteredCount, getFilteredMember } from './MentionMenu.js'

const CHAT_UPLOAD_PREFIX = '__chat_uploads/'

interface Props {
  channelId: string
  onSend: (content: string, metadata?: Record<string, unknown>) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  members?: ChannelMemberInfo[]
  quotedMessage?: ChatMessage | null
  onClearQuote?: () => void
  insertText?: string | null
  onInsertTextConsumed?: () => void
}

export function MessageInput({
  channelId,
  onSend,
  disabled,
  placeholder = '输入消息...',
  className,
  members = [],
  quotedMessage,
  onClearQuote,
  insertText,
  onInsertTextConsumed,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadFile, uploading, uploadProgress } = useStorage(channelId)

  // Mention state
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState(-1)
  const [storageRefs, setStorageRefs] = useState<string[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const autoResize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  useEffect(() => {
    if (!insertText) return
    const el = ref.current
    if (!el) return
    if (insertText.startsWith('storage://')) {
      setStorageRefs((refs) => refs.includes(insertText) ? refs : [...refs, insertText])
      el.focus()
      onInsertTextConsumed?.()
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const before = el.value.slice(0, start)
    const after = el.value.slice(end)
    const prefix = before.length > 0 && !before.endsWith('\n') && !before.endsWith(' ') ? ' ' : ''
    const suffix = after.length > 0 && !after.startsWith('\n') && !after.startsWith(' ') ? ' ' : ''
    const text = `${prefix}${insertText}${suffix}`
    el.value = before + text + after
    const cursor = before.length + text.length
    el.setSelectionRange(cursor, cursor)
    autoResize()
    el.focus()
    onInsertTextConsumed?.()
  }, [insertText, onInsertTextConsumed, autoResize])

  const insertMention = useCallback((member: ChannelMemberInfo) => {
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
    const typedContent = el.value.trim()
    const refsContent = storageRefs.length > 0
      ? `引用文件：\n${storageRefs.map((item) => `- ${item}`).join('\n')}`
      : ''
    const content = [typedContent, refsContent].filter(Boolean).join('\n\n')
    if (!content) return
    onSend(content)
    el.value = ''
    setStorageRefs([])
    setMentionOpen(false)
    autoResize()
    el.focus()
  }, [onSend, autoResize, storageRefs])

  const handleAttachFile = useCallback(async (file: File | undefined) => {
    if (!file || disabled) return
    setAttachmentError(null)
    try {
      const uploaded = await uploadFile(file, CHAT_UPLOAD_PREFIX)
      if (!uploaded?.key) return
      const refText = storageRefFromKey(uploaded.key)
      setStorageRefs((refs) => refs.includes(refText) ? refs : [...refs, refText])
      setMentionOpen(false)
      ref.current?.focus()
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : '文件上传失败')
    }
  }, [disabled, uploadFile])

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

        {storageRefs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1">
            {storageRefs.map((item) => (
              <span
                key={item}
                title={item.replace(/^storage:\/\//, '')}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#d8dde6] bg-[#f8fafc] px-2 py-1 text-xs font-medium text-[#333840]"
              >
                <span className="min-w-0 max-w-[260px] truncate">{fileNameFromStorageRef(item)}</span>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-[#888] hover:bg-black/5 hover:text-[#333]"
                  onClick={() => setStorageRefs((refs) => refs.filter((ref) => ref !== item))}
                  aria-label="移除引用文件"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {attachmentError && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs text-red-600">
            <span className="min-w-0 flex-1 truncate">{attachmentError}</span>
            <button type="button" className="rounded p-0.5 hover:bg-red-50" onClick={() => setAttachmentError(null)} aria-label="关闭上传错误">
              <X className="h-3 w-3" />
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
              disabled={disabled || uploading}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                void handleAttachFile(file)
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
              disabled={disabled || uploading}
              onClick={handleSend}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? <span className="text-[10px] font-medium">{uploadProgress}%</span> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
