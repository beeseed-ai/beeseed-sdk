import { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { X, Plus, AtSign, Zap, ListChecks, Workflow, ArrowUp } from 'lucide-react'
import type { ChatMessage, ChannelMemberInfo, SelectedSkillIntent, SkillShortcutAgent, SkillShortcutOption } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { fileNameFromStorageRef, storageRefFromKey } from '../../lib/storage-ref.js'
import { useStorage } from '../../hooks/use-storage.js'
import { MentionMenu, getFilteredCount, getFilteredMember } from './MentionMenu.js'
import { StorageFileIcon, storageFileLabelForRef } from './StorageAttachmentPreview.js'
import { SkillIcon } from '../skills/SkillIcon.js'

const CHAT_UPLOAD_PREFIX = '__chat_uploads/'
const MAX_SELECTED_SKILLS = 5

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
  skillOptions?: SkillShortcutOption[]
}

function skillDisplayName(skill: SkillShortcutOption) {
  return skill.display_name || skill.name
}

function agentDisplayName(member: ChannelMemberInfo): string {
  return member.display_name || member.nickname || member.agent_id || member.user_id || 'unknown'
}

function agentChoicesFromMembers(members: ChannelMemberInfo[]): SkillShortcutAgent[] {
  return members
    .filter((member) => member.member_type === 'agent' && !!member.agent_id)
    .map((member) => ({
      agent_id: member.agent_id!,
      agent_name: agentDisplayName(member),
    }))
}

function selectedSkillKey(skill: Pick<SelectedSkillIntent, 'skill_id' | 'agent_id'>) {
  return `${skill.skill_id}:${skill.agent_id}`
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
  skillOptions = [],
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skillMenuRef = useRef<HTMLDivElement>(null)
  const skillScrollRef = useRef<HTMLDivElement>(null)
  const skillTriggerRef = useRef<HTMLButtonElement>(null)
  const activeSkillItemRef = useRef<HTMLButtonElement>(null)
  const { uploadFile, uploading, uploadProgress } = useStorage(channelId)

  // Mention state
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState(-1)
  const [storageRefs, setStorageRefs] = useState<string[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkillIntent[]>([])
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const [skillQuery, setSkillQuery] = useState('')
  const [skillIndex, setSkillIndex] = useState(0)
  const [skillSlashStart, setSkillSlashStart] = useState(-1)
  const [pendingSkill, setPendingSkill] = useState<SkillShortcutOption | null>(null)
  const [replaceSkillKey, setReplaceSkillKey] = useState<string | null>(null)
  const [skillError, setSkillError] = useState<string | null>(null)

  const agentChoices = useMemo(() => agentChoicesFromMembers(members), [members])
  const filteredSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase()
    return skillOptions
      .filter((skill) => {
        if (!query) return true
        return [skill.name, skill.display_name, skill.description, ...(skill.agents ?? []).map((agent) => agent.agent_name)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      })
      .sort((a, b) => {
        const aAssociated = (a.agents?.length ?? 0) > 0 ? 0 : 1
        const bAssociated = (b.agents?.length ?? 0) > 0 ? 0 : 1
        if (aAssociated !== bAssociated) return aAssociated - bAssociated
        return skillDisplayName(a).localeCompare(skillDisplayName(b), 'zh-CN')
      })
      .slice(0, 8)
  }, [skillOptions, skillQuery])

  const pendingAgentChoices = useMemo(() => {
    if (!pendingSkill) return []
    return pendingSkill.agents && pendingSkill.agents.length > 0 ? pendingSkill.agents : agentChoices
  }, [agentChoices, pendingSkill])

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

  const closeSkillMenu = useCallback(() => {
    setSkillMenuOpen(false)
    setPendingSkill(null)
    setSkillQuery('')
    setSkillIndex(0)
    setSkillSlashStart(-1)
    setReplaceSkillKey(null)
  }, [])

  useLayoutEffect(() => {
    if (!skillMenuOpen) return
    const activeItem = activeSkillItemRef.current
    const scrollContainer = skillScrollRef.current
    if (!activeItem || !scrollContainer) return

    const itemTop = activeItem.offsetTop
    const itemBottom = itemTop + activeItem.offsetHeight
    const viewTop = scrollContainer.scrollTop
    const viewBottom = viewTop + scrollContainer.clientHeight

    if (itemTop < viewTop) {
      scrollContainer.scrollTop = itemTop
    } else if (itemBottom > viewBottom) {
      scrollContainer.scrollTop = itemBottom - scrollContainer.clientHeight
    }
  }, [skillIndex, skillMenuOpen, pendingSkill, filteredSkills.length, pendingAgentChoices.length])

  useEffect(() => {
    if (!skillMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (skillMenuRef.current?.contains(target)) return
      if (skillTriggerRef.current?.contains(target)) return
      closeSkillMenu()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [closeSkillMenu, skillMenuOpen])

  const removeSlashToken = useCallback(() => {
    const el = ref.current
    if (!el || skillSlashStart < 0) return
    const cursor = el.selectionStart ?? el.value.length
    el.value = `${el.value.slice(0, skillSlashStart)}${el.value.slice(cursor)}`
    el.setSelectionRange(skillSlashStart, skillSlashStart)
    autoResize()
  }, [autoResize, skillSlashStart])

  const addSelectedSkill = useCallback((skill: SkillShortcutOption, agent: SkillShortcutAgent, source: SelectedSkillIntent['source']) => {
    if (replaceSkillKey) {
      setSelectedSkills((current) => current.map((existing) => (
        selectedSkillKey(existing) === replaceSkillKey
          ? { ...existing, agent_id: agent.agent_id, agent_name: agent.agent_name, source }
          : existing
      )))
      setSkillError(null)
      closeSkillMenu()
      ref.current?.focus()
      return
    }
    if (selectedSkills.length >= MAX_SELECTED_SKILLS) {
      setSkillError(`最多选择 ${MAX_SELECTED_SKILLS} 个技能`)
      return
    }
    const item: SelectedSkillIntent = {
      skill_id: skill.name,
      skill_name: skill.name,
      skill_display_name: skill.display_name,
      skill_description: skill.description,
      skill_icon_url: skill.icon_url,
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      source,
    }
    setSelectedSkills((current) => {
      if (current.some((existing) => selectedSkillKey(existing) === selectedSkillKey(item))) return current
      return [...current, item]
    })
    setSkillError(null)
    removeSlashToken()
    closeSkillMenu()
    ref.current?.focus()
  }, [closeSkillMenu, removeSlashToken, replaceSkillKey, selectedSkills.length])

  const chooseSkill = useCallback((skill: SkillShortcutOption, source: SelectedSkillIntent['source']) => {
    const agents = skill.agents ?? []
    if (agents.length === 1) {
      addSelectedSkill(skill, agents[0]!, source)
      return
    }
    setPendingSkill(skill)
    setSkillIndex(0)
    setSkillError(null)
  }, [addSelectedSkill])

  const choosePendingAgent = useCallback((agent: SkillShortcutAgent) => {
    if (!pendingSkill) return
    addSelectedSkill(pendingSkill, agent, skillSlashStart >= 0 ? 'slash' : 'skill_button')
  }, [addSelectedSkill, pendingSkill, skillSlashStart])

  const replaceSelectedSkillAgent = useCallback((item: SelectedSkillIntent) => {
    const option = skillOptions.find((skill) => skill.name === item.skill_id) ?? {
      name: item.skill_id,
      display_name: item.skill_display_name || item.skill_name,
      description: item.skill_description,
      agents: agentChoices,
    }
    setMentionOpen(false)
    setPendingSkill({ ...option, agents: agentChoices })
    setReplaceSkillKey(selectedSkillKey(item))
    setSkillMenuOpen(true)
    setSkillQuery('')
    setSkillIndex(0)
    setSkillSlashStart(-1)
    setSkillError(null)
    ref.current?.focus()
  }, [agentChoices, skillOptions])

  const handleSend = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (pendingSkill) {
      setSkillError('请先为技能选择执行 Agent')
      return
    }
    const typedContent = el.value.trim()
    const refsContent = storageRefs.length > 0
      ? `引用文件：\n${storageRefs.map((item) => `- ${item}`).join('\n')}`
      : ''
    const content = [typedContent, refsContent].filter(Boolean).join('\n\n')
    if (!content) return
    const metadata = selectedSkills.length > 0 ? { selected_skills: selectedSkills } : undefined
    onSend(content, metadata)
    el.value = ''
    setStorageRefs([])
    setSelectedSkills([])
    setSkillError(null)
    setMentionOpen(false)
    closeSkillMenu()
    autoResize()
    el.focus()
  }, [onSend, autoResize, storageRefs, selectedSkills, pendingSkill, closeSkillMenu])

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
      if (skillMenuOpen) {
        const activeCount = pendingSkill ? pendingAgentChoices.length : filteredSkills.length
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSkillIndex((i) => (i + 1) % Math.max(activeCount, 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSkillIndex((i) => (i - 1 + Math.max(activeCount, 1)) % Math.max(activeCount, 1))
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          if (pendingSkill) {
            const agent = pendingAgentChoices[skillIndex]
            if (agent) choosePendingAgent(agent)
          } else {
            const skill = filteredSkills[skillIndex]
            if (skill) chooseSkill(skill, skillSlashStart >= 0 ? 'slash' : 'skill_button')
          }
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          closeSkillMenu()
          return
        }
      }

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
        return
      }

      if (e.key === 'Backspace') {
        const el = ref.current
        if (el && el.selectionStart === 0 && el.selectionEnd === 0 && el.value.length === 0 && selectedSkills.length > 0) {
          e.preventDefault()
          setSelectedSkills((skills) => skills.slice(0, -1))
        }
      }
    },
    [
      skillMenuOpen, pendingSkill, pendingAgentChoices, filteredSkills, skillIndex, skillSlashStart,
      choosePendingAgent, chooseSkill, closeSkillMenu,
      mentionOpen, mentionQuery, mentionIndex, members, handleSend, insertMention, selectedSkills.length,
    ],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      autoResize()

      const el = e.target
      const pos = el.selectionStart
      const text = el.value

      // Detect / skill trigger. Keep it separate from @ mention to avoid mixed menus.
      if (pos > 0 && text[pos - 1] === '/') {
        const charBefore = pos > 1 ? text[pos - 2] : ' '
        if (charBefore === ' ' || charBefore === '\n' || pos === 1) {
          setMentionOpen(false)
          setSkillMenuOpen(true)
          setPendingSkill(null)
          setSkillQuery('')
          setSkillIndex(0)
          setSkillSlashStart(pos - 1)
          return
        }
      }

      if (skillMenuOpen && skillSlashStart >= 0) {
        const triggerStillPresent = skillSlashStart < text.length && text[skillSlashStart] === '/' && pos > skillSlashStart
        const charBefore = skillSlashStart > 0 ? text[skillSlashStart - 1] : ' '
        if (!triggerStillPresent || (charBefore !== ' ' && charBefore !== '\n')) {
          closeSkillMenu()
        } else {
          const query = text.slice(skillSlashStart + 1, pos)
          if (query.includes(' ') || query.includes('\n')) {
            closeSkillMenu()
          } else {
            setSkillQuery(query)
            setSkillIndex(0)
          }
        }
      }

      if (members.length === 0) return

      // Detect @ trigger
      if (pos > 0 && text[pos - 1] === '@') {
        const charBefore = pos > 1 ? text[pos - 2] : ' '
        if (charBefore === ' ' || charBefore === '\n' || pos === 1) {
          closeSkillMenu()
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
    [autoResize, members.length, mentionOpen, mentionStart, skillMenuOpen, skillSlashStart, closeSkillMenu],
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

  const triggerSkillMenu = () => {
    if (skillMenuOpen) {
      closeSkillMenu()
      setSkillError(null)
      ref.current?.focus()
      return
    }
    if (skillOptions.length === 0) {
      setSkillError('暂无可用技能')
      return
    }
    setMentionOpen(false)
    setSkillMenuOpen(true)
    setPendingSkill(null)
    setSkillQuery('')
    setSkillIndex(0)
    setSkillSlashStart(-1)
    ref.current?.focus()
  }

  return (
    <div className={cn('relative shrink-0 bg-[#fafafa]', className)}>
      {/* Unified input card — textarea + toolbar in one bordered container */}
      <div
        className="relative rounded-xl border border-border bg-white shadow-sm transition-colors focus-within:border-[#9297a0]"
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

        {skillMenuOpen && (
          <div
            ref={skillMenuRef}
            className="absolute bottom-full left-0 right-0 mb-1 z-50 max-h-80 w-full overflow-hidden rounded-lg border border-[#dddddd] bg-white shadow-lg"
          >
            <div className="border-b border-[#eeeeee] px-3 py-2">
              {pendingSkill ? (
                <>
                  <div className="text-xs font-medium text-[#181d26]">{replaceSkillKey ? '更换执行 Agent' : '选择执行 Agent'}</div>
                  <div className="mt-0.5 truncate text-[11px] text-[#777169]">{skillDisplayName(pendingSkill)} 需要指定执行者</div>
                </>
              ) : (
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <span className="shrink-0 font-medium text-[#181d26]">选择技能</span>
                  <span className="min-w-0 truncate text-[11px] text-[#777169]">输入 / 后可继续键入关键词过滤</span>
                </div>
              )}
            </div>
            <div ref={skillScrollRef} className="max-h-[min(16rem,55dvh)] overflow-y-auto py-1">
              {pendingSkill ? (
                pendingAgentChoices.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-[#777169]">当前频道暂无可执行 Agent</div>
                ) : pendingAgentChoices.map((agent, index) => (
                  <button
                    key={agent.agent_id}
                    ref={index === skillIndex ? activeSkillItemRef : undefined}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                      index === skillIndex ? 'bg-[#181d26] text-white' : 'text-[#181d26] hover:bg-[#f8fafc]',
                    )}
                    onMouseDown={(e) => { e.preventDefault(); choosePendingAgent(agent) }}
                  >
                    <span className="min-w-0 truncate">@{agent.agent_name}</span>
                    <span className={cn('shrink-0 font-mono text-[10px]', index === skillIndex ? 'text-white/70' : 'text-[#777169]')}>{agent.agent_id}</span>
                  </button>
                ))
              ) : filteredSkills.length === 0 ? (
                <div className="px-3 py-3 text-xs text-[#777169]">没有匹配的技能</div>
              ) : filteredSkills.map((skill, index) => {
                const agents = skill.agents ?? []
                const agentNames = agents.map((agent) => agent.agent_name).filter(Boolean).join('、')
                return (
                  <button
                    key={skill.name}
                    ref={index === skillIndex ? activeSkillItemRef : undefined}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left',
                      index === skillIndex ? 'bg-[#181d26] text-white' : 'text-[#181d26] hover:bg-[#f8fafc]',
                    )}
                    onMouseDown={(e) => { e.preventDefault(); chooseSkill(skill, skillSlashStart >= 0 ? 'slash' : 'skill_button') }}
                  >
                    <SkillIcon
                      name={skill.name}
                      iconUrl={skill.icon_url}
                      className={cn('size-8 rounded-lg border', index === skillIndex ? 'border-white/20 bg-white/15 text-white' : 'border-[#dddddd] bg-white')}
                      fallback={<Zap className="size-3.5" />}
                    />
                    <span className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[minmax(96px,max-content)_minmax(0,1fr)_auto] sm:items-center sm:gap-2">
                      <span className={cn('min-w-0 truncate text-sm font-medium', index === skillIndex ? 'text-white' : 'text-[#181d26]')}>
                        {skillDisplayName(skill)}
                      </span>
                      <span className={cn('min-w-0 truncate text-xs', index === skillIndex ? 'text-white/75' : 'text-[#777169]')}>
                        {skill.description || ''}
                      </span>
                      {agentNames && (
                        <span className={cn('min-w-0 truncate text-xs font-medium sm:max-w-[180px] sm:shrink-0 sm:text-right', index === skillIndex ? 'text-white/80' : 'text-[#41454d]')}>
                          {agentNames}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
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

        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1">
            {selectedSkills.map((item) => (
              <span
                key={selectedSkillKey(item)}
                title={item.skill_description || item.skill_name}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#d8dde6] bg-[#f8fafc] px-2 py-1 text-xs font-medium text-[#333840]"
              >
                <SkillIcon name={item.skill_name} iconUrl={item.skill_icon_url} className="size-5 rounded bg-white" fallback={<Zap className="h-3.5 w-3.5" />} />
                <span className="min-w-0 max-w-[180px] truncate">/{item.skill_display_name || item.skill_name}</span>
                <button
                  type="button"
                  className="shrink-0 rounded-sm bg-white px-1 text-[10px] font-medium text-[#777169] hover:text-[#181d26]"
                  onClick={() => replaceSelectedSkillAgent(item)}
                  title="更换执行 Agent"
                >
                  @{item.agent_name}
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-[#888] hover:bg-black/5 hover:text-[#333]"
                  onClick={() => setSelectedSkills((skills) => skills.filter((skill) => selectedSkillKey(skill) !== selectedSkillKey(item)))}
                  aria-label="移除技能"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
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
                <StorageFileIcon refText={item} className="h-3.5 w-3.5 shrink-0 text-[#254fad]" />
                <span className="min-w-0 max-w-[220px] truncate">{fileNameFromStorageRef(item)}</span>
                <span className="shrink-0 rounded-sm bg-white px-1 text-[10px] font-medium text-[#777169]">{storageFileLabelForRef(item)}</span>
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

        {(attachmentError || skillError) && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs text-red-600">
            <span className="min-w-0 flex-1 truncate">{attachmentError || skillError}</span>
            <button type="button" className="rounded p-0.5 hover:bg-red-50" onClick={() => { setAttachmentError(null); setSkillError(null) }} aria-label="关闭错误提示">
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
            <button
              ref={skillTriggerRef}
              type="button"
              onClick={triggerSkillMenu}
              className="flex items-center gap-1 h-8 px-2 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors text-sm shrink-0"
            >
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
          {/* Right side — send */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              disabled={disabled || uploading || !!pendingSkill}
              onClick={handleSend}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={pendingSkill ? '请先选择执行 Agent' : '发送'}
            >
              {uploading ? <span className="text-[10px] font-medium">{uploadProgress}%</span> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
