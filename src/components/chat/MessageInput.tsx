import { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { useStore } from 'zustand'
import { X, Plus, AtSign, Zap, ListChecks, Workflow, ArrowUp, Play, RefreshCw, Sparkles } from 'lucide-react'
import type { ChatMessage, ChannelMemberInfo, SelectedSkillIntent, SkillShortcutAgent, SkillShortcutOption, Workflow as WorkflowDefinition } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { fileNameFromStorageRef, storageRefFromKey } from '../../lib/storage-ref.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { useStorage } from '../../hooks/use-storage.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
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
  quickQuestions?: string[]
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

function workflowStatusLabel(status: WorkflowDefinition['status']) {
  switch (status) {
    case 'enabled': return '已发布'
    case 'disabled': return '已停用'
    case 'archived': return '已归档'
    default: return '草稿'
  }
}

function workflowSettingsObject(settings: WorkflowDefinition['settings']): Record<string, unknown> {
  if (!settings) return {}
  if (typeof settings === 'string') {
    try {
      const parsed = JSON.parse(settings)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return settings
}

function workflowManualBlockReason(workflow: WorkflowDefinition, canManage: boolean): string | null {
  if (!canManage) return '只有频道 owner/admin 可以手动启动工作流'
  if (workflow.status === 'draft') return '还是草稿，先发布后才能手动启动'
  if (workflow.status === 'disabled') return '工作流已停用，启用后才能手动启动'
  if (workflow.status === 'archived') return '工作流已归档，不能手动启动'
  if (!workflow.active_version_id) return '没有可运行版本，先发布后才能启动'
  const settings = workflowSettingsObject(workflow.settings)
  if (settings.manual_start_enabled === false) {
    const reason = settings.manual_start_disabled_reason
    return typeof reason === 'string' && reason.trim()
      ? reason.trim()
      : '该工作流关闭了手动启动，只能由触发器自动运行'
  }
  return null
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
  quickQuestions = [],
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skillMenuRef = useRef<HTMLDivElement>(null)
  const skillScrollRef = useRef<HTMLDivElement>(null)
  const skillTriggerRef = useRef<HTMLButtonElement>(null)
  const workflowMenuRef = useRef<HTMLDivElement>(null)
  const workflowTriggerRef = useRef<HTMLButtonElement>(null)
  const quickQuestionMenuRef = useRef<HTMLDivElement>(null)
  const quickQuestionTriggerRef = useRef<HTMLButtonElement>(null)
  const activeSkillItemRef = useRef<HTMLButtonElement>(null)
  const { user } = useAuth()
  const { openWorkflowRun, openWorkflowCreate } = useDetailPanel()
  const { workflowsStore } = useBeeSeedContext()
  const workflowState = useStore(workflowsStore)
  const { uploadFile, uploading, uploadProgress } = useStorage(channelId)
  const workflows = workflowState.workflows
  const workflowsLoading = workflowState.loading

  useEffect(() => {
    if (!channelId) return
    void workflowState.fetchWorkflows(channelId)
  }, [channelId])

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
  const [workflowMenuOpen, setWorkflowMenuOpen] = useState(false)
  const [workflowQuery, setWorkflowQuery] = useState('')
  const [workflowError, setWorkflowError] = useState<string | null>(null)
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null)
  const [quickQuestionMenuOpen, setQuickQuestionMenuOpen] = useState(false)

  const agentChoices = useMemo(() => agentChoicesFromMembers(members), [members])
  const currentMember = useMemo(
    () => members.find((member) => member.member_type === 'user' && member.user_id === user?.id),
    [members, user?.id],
  )
  const canManageWorkflows = user?.role === 'owner'
    || user?.role === 'admin'
    || user?.role === 'super_admin'
    || currentMember?.role === 'owner'
    || currentMember?.role === 'admin'
  const channelWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.channel_id === channelId),
    [channelId, workflows],
  )
  const filteredWorkflows = useMemo(() => {
    const query = workflowQuery.trim().toLowerCase()
    if (!query) return channelWorkflows
    return channelWorkflows.filter((workflow) => (
      workflow.name.toLowerCase().includes(query)
      || workflow.description?.toLowerCase().includes(query)
      || workflowStatusLabel(workflow.status).includes(query)
    ))
  }, [channelWorkflows, workflowQuery])
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
  }, [skillOptions, skillQuery])
  const normalizedQuickQuestions = useMemo(() => (
    quickQuestions
      .map((question) => question.trim())
      .filter((question, index, list) => Boolean(question) && list.indexOf(question) === index)
      .slice(0, 12)
  ), [quickQuestions])

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

  const closeWorkflowMenu = useCallback(() => {
    setWorkflowMenuOpen(false)
    setWorkflowQuery('')
  }, [])

  const closeQuickQuestionMenu = useCallback(() => {
    setQuickQuestionMenuOpen(false)
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

  useEffect(() => {
    if (!workflowMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (workflowMenuRef.current?.contains(target)) return
      if (workflowTriggerRef.current?.contains(target)) return
      closeWorkflowMenu()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [closeWorkflowMenu, workflowMenuOpen])

  useEffect(() => {
    if (!quickQuestionMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (quickQuestionMenuRef.current?.contains(target)) return
      if (quickQuestionTriggerRef.current?.contains(target)) return
      closeQuickQuestionMenu()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [closeQuickQuestionMenu, quickQuestionMenuOpen])

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
    closeWorkflowMenu()
    closeQuickQuestionMenu()
    autoResize()
    el.focus()
  }, [onSend, autoResize, storageRefs, selectedSkills, pendingSkill, closeSkillMenu, closeWorkflowMenu, closeQuickQuestionMenu])

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
      if (workflowMenuOpen && e.key === 'Escape') {
        e.preventDefault()
        closeWorkflowMenu()
        return
      }

      if (quickQuestionMenuOpen && e.key === 'Escape') {
        e.preventDefault()
        closeQuickQuestionMenu()
        return
      }

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
      workflowMenuOpen, closeWorkflowMenu,
      quickQuestionMenuOpen, closeQuickQuestionMenu,
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
          closeWorkflowMenu()
          closeQuickQuestionMenu()
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
          closeWorkflowMenu()
          closeQuickQuestionMenu()
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
    [autoResize, members.length, mentionOpen, mentionStart, skillMenuOpen, skillSlashStart, closeSkillMenu, closeWorkflowMenu, closeQuickQuestionMenu],
  )

  const triggerMention = () => {
    const el = ref.current
    if (!el) return
    const pos = el.selectionStart
    el.value = el.value.slice(0, pos) + '@' + el.value.slice(pos)
    el.setSelectionRange(pos + 1, pos + 1)
    el.focus()
    el.dispatchEvent(new Event('input', { bubbles: true }))
    closeWorkflowMenu()
    closeQuickQuestionMenu()
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
    closeWorkflowMenu()
    closeQuickQuestionMenu()
    setSkillMenuOpen(true)
    setPendingSkill(null)
    setSkillQuery('')
    setSkillIndex(0)
    setSkillSlashStart(-1)
    ref.current?.focus()
  }

  const triggerWorkflowMenu = () => {
    if (workflowMenuOpen) {
      closeWorkflowMenu()
      setWorkflowError(null)
      ref.current?.focus()
      return
    }
    closeSkillMenu()
    setMentionOpen(false)
    closeQuickQuestionMenu()
    setWorkflowMenuOpen(true)
    setWorkflowQuery('')
    setWorkflowError(null)
    void workflowState.fetchWorkflows(channelId)
    ref.current?.focus()
  }

  const triggerQuickQuestionMenu = () => {
    if (quickQuestionMenuOpen) {
      closeQuickQuestionMenu()
      ref.current?.focus()
      return
    }
    if (normalizedQuickQuestions.length === 0) return
    closeSkillMenu()
    closeWorkflowMenu()
    setMentionOpen(false)
    setQuickQuestionMenuOpen(true)
    ref.current?.focus()
  }

  const insertQuickQuestion = (question: string) => {
    const el = ref.current
    const cleanQuestion = question.trim()
    if (!el || !cleanQuestion) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const before = el.value.slice(0, start)
    const after = el.value.slice(end)
    const prefix = before.length > 0 && !/[\s\n]$/.test(before) ? '\n' : ''
    const suffix = after.length > 0 && !/^[\s\n]/.test(after) ? '\n' : ''
    const inserted = `${prefix}${cleanQuestion}${suffix}`
    el.value = before + inserted + after
    const cursor = before.length + inserted.length
    el.setSelectionRange(cursor, cursor)
    closeQuickQuestionMenu()
    autoResize()
    el.focus()
  }

  const handleCreateWorkflowShortcut = () => {
    if (!canManageWorkflows) {
      setWorkflowError('只有频道 owner/admin 可以新建工作流')
      return
    }
    closeWorkflowMenu()
    openWorkflowCreate(channelId)
    ref.current?.focus()
  }

  const handleStartWorkflow = async (workflow: WorkflowDefinition) => {
    const blockReason = workflowManualBlockReason(workflow, canManageWorkflows)
    if (blockReason || runningWorkflowId) {
      if (blockReason) setWorkflowError(blockReason)
      return
    }
    setRunningWorkflowId(workflow.id)
    setWorkflowError(null)
    try {
      const detail = await workflowState.runWorkflow(workflow.channel_id, workflow.id)
      if (!detail) {
        setWorkflowError('启动失败：请检查权限、发布状态或稍后重试')
        return
      }
      closeWorkflowMenu()
      openWorkflowRun(detail.run.id)
    } finally {
      setRunningWorkflowId(null)
      ref.current?.focus()
    }
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

        {workflowMenuOpen && (
          <div
            ref={workflowMenuRef}
            className="absolute bottom-full left-0 right-0 mb-1 z-50 max-h-[min(24rem,70dvh)] w-full overflow-hidden rounded-lg border border-[#dddddd] bg-white shadow-lg"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#eeeeee] px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#181d26]">当前频道工作流</div>
                <div className="mt-0.5 truncate text-[11px] text-[#777169]">
                  只显示与这个频道绑定的工作流
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-[#dddddd] bg-white px-2 text-xs font-medium text-[#41454d] hover:bg-[#f8fafc]"
                  onMouseDown={(e) => { e.preventDefault(); void workflowState.fetchWorkflows(channelId) }}
                  title="刷新工作流列表"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  刷新
                </button>
                <button
                  type="button"
                  disabled={!canManageWorkflows}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-[#181d26] px-2 text-xs font-medium text-white hover:bg-[#2b3038] disabled:cursor-not-allowed disabled:bg-[#d1d5db]"
                  onMouseDown={(e) => { e.preventDefault(); handleCreateWorkflowShortcut() }}
                  title={canManageWorkflows ? '在当前频道新建工作流' : '只有频道 owner/admin 可以新建工作流'}
                >
                  <Plus className="h-3.5 w-3.5" />
                  新建
                </button>
              </div>
            </div>

            {channelWorkflows.length > 4 && (
              <div className="border-b border-[#eeeeee] px-3 py-2">
                <input
                  value={workflowQuery}
                  onChange={(event) => setWorkflowQuery(event.target.value)}
                  placeholder="搜索工作流"
                  className="h-8 w-full rounded-md border border-[#dddddd] bg-white px-2 text-xs text-[#181d26] outline-none focus:border-[#181d26]"
                />
              </div>
            )}

            <div className="max-h-[min(18rem,55dvh)] overflow-y-auto py-1">
              {workflowsLoading && channelWorkflows.length === 0 ? (
                <div className="px-3 py-4 text-xs text-[#777169]">正在加载工作流...</div>
              ) : filteredWorkflows.length === 0 ? (
                <div className="px-3 py-4 text-xs leading-5 text-[#777169]">
                  {channelWorkflows.length === 0 ? '当前频道还没有绑定工作流。' : '没有匹配的工作流。'}
                  {canManageWorkflows ? ' 可以点击“新建”进入工作流编辑器。' : ' 只有频道 owner/admin 可以新建或启动。'}
                </div>
              ) : filteredWorkflows.map((workflow) => {
                const blockReason = workflowManualBlockReason(workflow, canManageWorkflows)
                const starting = runningWorkflowId === workflow.id
                const startDisabled = !!blockReason || !!runningWorkflowId
                return (
                  <div
                    key={workflow.id}
                    className="flex items-start gap-3 px-3 py-2 hover:bg-[#f8fafc]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-[#181d26]">{workflow.name || '未命名工作流'}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                            workflow.status === 'enabled'
                              ? 'border-[#b7e4c7] bg-[#ecfdf3] text-[#15803d]'
                              : 'border-[#dddddd] bg-[#f8fafc] text-[#777169]',
                          )}
                        >
                          {workflowStatusLabel(workflow.status)}
                        </span>
                      </div>
                      <div className={cn('mt-1 line-clamp-2 text-xs leading-5', blockReason ? 'text-[#9a3412]' : 'text-[#777169]')}>
                        {blockReason || workflow.description || '点击启动会立即创建一次手动运行'}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={startDisabled}
                      className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#d8dde6] bg-white px-2 text-xs font-medium text-[#181d26] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:text-[#9aa1ad]"
                      onMouseDown={(e) => { e.preventDefault(); void handleStartWorkflow(workflow) }}
                      title={blockReason || '启动工作流'}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {blockReason ? '不可启动' : starting ? '启动中' : '启动'}
                    </button>
                  </div>
                )
              })}
            </div>

            {!canManageWorkflows && (
              <div className="border-t border-[#eeeeee] px-3 py-2 text-[11px] leading-5 text-[#777169]">
                你可以查看关联工作流，但只有频道 owner/admin 可以新建或手动启动。
              </div>
            )}
          </div>
        )}

        {quickQuestionMenuOpen && normalizedQuickQuestions.length > 0 && (
          <div
            ref={quickQuestionMenuRef}
            className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-[min(20rem,62dvh)] w-full overflow-hidden rounded-lg border border-[#dddddd] bg-white shadow-lg"
          >
            <div className="border-b border-[#eeeeee] px-3 py-2">
              <div className="text-xs font-medium text-[#181d26]">快捷提问</div>
              <div className="mt-0.5 truncate text-[11px] text-[#777169]">选择后台为当前频道配置的问题，插入到输入框后可继续编辑。</div>
            </div>
            <div className="max-h-[min(16rem,52dvh)] overflow-y-auto py-1">
              {normalizedQuickQuestions.map((question, index) => (
                <button
                  key={`${question}-${index}`}
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-[#181d26] hover:bg-[#f8fafc] focus-visible:bg-[#f8fafc] focus-visible:outline-none"
                  onMouseDown={(event) => { event.preventDefault(); insertQuickQuestion(question) }}
                >
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0f766e]" />
                  <span className="min-w-0 flex-1 leading-5">{question}</span>
                </button>
              ))}
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

        {(attachmentError || skillError || workflowError) && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs text-red-600">
            <span className="min-w-0 flex-1 truncate">{attachmentError || skillError || workflowError}</span>
            <button type="button" className="rounded p-0.5 hover:bg-red-50" onClick={() => { setAttachmentError(null); setSkillError(null); setWorkflowError(null) }} aria-label="关闭错误提示">
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
            {normalizedQuickQuestions.length > 0 && (
              <button
                ref={quickQuestionTriggerRef}
                type="button"
                onClick={triggerQuickQuestionMenu}
                className={cn(
                  'flex items-center gap-1 h-8 px-2 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors text-sm shrink-0',
                  quickQuestionMenuOpen && 'bg-black/5 text-black',
                )}
                title="快捷提问"
              >
                <Sparkles className="w-4 h-4" />
                <span>快捷</span>
              </button>
            )}
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
            <button
              ref={workflowTriggerRef}
              type="button"
              onClick={triggerWorkflowMenu}
              className={cn(
                'flex items-center gap-1 h-8 px-2 rounded-lg text-[#888] hover:text-black hover:bg-black/5 transition-colors text-sm shrink-0',
                workflowMenuOpen && 'bg-black/5 text-black',
              )}
            >
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
