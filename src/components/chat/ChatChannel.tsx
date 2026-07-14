import { useEffect, useMemo, useState, useCallback } from 'react'
import type { ArtifactRevisionTarget, ChannelMemberInfo, ChannelRuntimeSettings, ChatArtifact, ChatMessage, SkillShortcutAgent, SkillShortcutOption } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useAppConfig } from '../../hooks/use-app-config.js'
import { useChannels } from '../../hooks/use-channels.js'
import { useChat } from '../../hooks/use-chat.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { MessageList } from './MessageList.js'
import { MessageInput } from './MessageInput.js'
import { AgentTodoRail } from './AgentTodoRail.js'

const CHAT_MAX_WIDTH = 820

interface Props {
  channelId: string
  className?: string
  header?: React.ReactNode
}

export function ChatChannel({ channelId, className, header }: Props) {
  const { user } = useAuth()
  const { api } = useBeeSeedContext()
  const { branding } = useAppConfig()
  const { channels } = useChannels()
  const {
    messages,
    streams,
    agentLoops,
    members,
    typings,
    send,
    sendWithQuote,
    submitAnswer,
    stopAgent,
    loading,
    hasOlderMessages,
    loadingOlderMessages,
    loadOlderMessages,
  } = useChat(channelId, { markRead: true })
  const { composerInsertText, consumeComposerInsert, openWorkflowRun } = useDetailPanel()
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null)
  const [revisionTarget, setRevisionTarget] = useState<ArtifactRevisionTarget | null>(null)
  const [configSkillOptions, setConfigSkillOptions] = useState<SkillShortcutOption[]>([])
  const channelSettings = useMemo(
    () => parseChannelRuntimeSettings(channels.find((channel) => channel.id === channelId)?.settings),
    [channels, channelId],
  )
  const welcomeTitle = channelSettings.welcome_title
  const welcomeMessage = channelSettings.welcome_message || branding.welcomeMessage
  const quickQuestions = channelSettings.quick_questions ?? []
  const memberSkillOptions = useMemo(() => buildSkillOptionsFromMembers(members), [members])

  useEffect(() => {
    let cancelled = false
    setConfigSkillOptions([])
    const agents = members.map(agentShortcut).filter((agent): agent is SkillShortcutAgent => Boolean(agent))
    if (!channelId || agents.length === 0) return

    const loadAgentConfigSkills = async () => {
      const agentConfigs = await Promise.all(agents.map(async (agent) => {
        const cfg = await api.get(`channels/${channelId}/agents/${encodeURIComponent(agent.agent_id)}/config`).json<Record<string, unknown>>().catch(() => null)
        return { agent, cfg }
      }))
      if (cancelled) return

      const byName = new Map<string, SkillShortcutOption>()
      for (const { agent, cfg } of agentConfigs) {
        if (!cfg) continue
        for (const name of collectSkillNames(cfg)) {
          const existing = byName.get(name)
          if (existing) {
            if (!existing.agents?.some((item) => item.agent_id === agent.agent_id)) {
              existing.agents = [...(existing.agents ?? []), agent]
            }
            continue
          }
          byName.set(name, {
            name,
            display_name: name,
            agents: [agent],
            source: 'agent',
          })
        }
      }
      setConfigSkillOptions([...byName.values()])
    }

    void loadAgentConfigSkills()
    return () => {
      cancelled = true
    }
  }, [api, channelId, members])

  const skillOptions = useMemo(
    () => mergeSkillOptions(memberSkillOptions, configSkillOptions),
    [memberSkillOptions, configSkillOptions],
  )

  const handleSend = useCallback((content: string, metadata?: Record<string, unknown>) => {
    if (quotedMessage) {
      sendWithQuote(content, quotedMessage, metadata)
      setQuotedMessage(null)
    } else {
      send(content, metadata)
    }
    setRevisionTarget(null)
  }, [quotedMessage, send, sendWithQuote])

  const handleReviseArtifact = useCallback((artifact: ChatArtifact, message: ChatMessage) => {
    setRevisionTarget({
      ...artifact,
      sourceMessageId: message.msgId,
      sourceRunId: message.agentRunId,
    })
  }, [])

  return (
    <div className={cn('flex h-full flex-col bg-[#fafafa]', className)}>
      {header}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <AgentTodoRail
          loops={agentLoops}
          streams={streams}
          members={members}
          className="absolute left-3 top-3 z-20 md:left-4 md:top-4"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm text-[#777169]">加载消息中...</span>
            </div>
          ) : (
            <MessageList
              channelId={channelId}
              messages={messages}
              streams={streams}
              agentLoops={agentLoops}
              members={members}
              typings={typings}
              onQuote={setQuotedMessage}
              currentUserId={user?.id}
              onSubmitAnswer={submitAnswer}
              onStopAgent={stopAgent}
              onOpenWorkflowRun={openWorkflowRun}
              onReviseArtifact={handleReviseArtifact}
              hasOlder={hasOlderMessages}
              loadingOlder={loadingOlderMessages}
              onLoadOlder={loadOlderMessages}
              welcomeTitle={welcomeTitle}
              welcomeFallbackTitle={branding.title}
              welcomeMessage={welcomeMessage}
              quickQuestions={quickQuestions}
              onQuickQuestion={(question) => handleSend(question, { source: 'quick_question' })}
            />
          )}

          {/* Input area — centered at max-width */}
          <div className="mx-auto w-full shrink-0 px-4 pb-4" style={{ maxWidth: CHAT_MAX_WIDTH + 32 }}>
            <MessageInput
              channelId={channelId}
              onSend={handleSend}
              members={members}
              quotedMessage={quotedMessage}
              onClearQuote={() => setQuotedMessage(null)}
              revisionTarget={revisionTarget}
              onClearRevisionTarget={() => setRevisionTarget(null)}
              insertText={composerInsertText}
              onInsertTextConsumed={consumeComposerInsert}
              skillOptions={skillOptions}
              quickQuestions={quickQuestions}
              placeholder={branding.inputPlaceholder}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return objectValue(parsed)
    } catch {
      return {}
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function stringArrayFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()]
    const obj = objectValue(item)
    return [
      stringValue(obj.name),
      stringValue(obj.skill),
      stringValue(obj.skill_name),
      stringValue(obj.id),
    ].filter((name): name is string => Boolean(name))
  })
}

function collectSkillNames(config: Record<string, unknown>): string[] {
  const capabilities = objectValue(config.capabilities)
  const skills = objectValue(config.skills)
  const seen = new Set<string>()
  const names = [
    ...stringArrayFrom(config.skills),
    ...stringArrayFrom(capabilities.skills),
    ...stringArrayFrom(skills.required),
    ...stringArrayFrom(skills.enabled),
  ]
  return names.filter((name) => {
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })
}

function agentShortcut(member: ChannelMemberInfo): SkillShortcutAgent | null {
  if (member.member_type !== 'agent' || !member.agent_id) return null
  return {
    agent_id: member.agent_id,
    agent_name: member.display_name || member.nickname || member.agent_id,
  }
}

function buildSkillOptionsFromMembers(members: ChannelMemberInfo[]): SkillShortcutOption[] {
  const byName = new Map<string, SkillShortcutOption>()

  for (const member of members) {
    const agent = agentShortcut(member)
    if (!agent) continue

    const extInfo = objectValue(member.ext_info)
    const rawSkills = Array.isArray(extInfo.skills) ? extInfo.skills : []
    for (const rawSkill of rawSkills) {
      const skill = objectValue(rawSkill)
      const name = stringValue(skill.name)
      if (!name) continue

      const existing = byName.get(name)
      if (existing) {
        if (!existing.agents?.some((item) => item.agent_id === agent.agent_id)) {
          existing.agents = [...(existing.agents ?? []), agent]
        }
        continue
      }

      byName.set(name, {
        name,
        display_name: stringValue(skill.display_name),
        description: stringValue(skill.description),
        icon_url: stringValue(skill.icon_url) || stringValue(skill.icon),
        agents: [agent],
        source: 'agent',
      })
    }
  }

  return [...byName.values()]
}

function mergeSkillOptions(memberOptions: SkillShortcutOption[], configOptions: SkillShortcutOption[]): SkillShortcutOption[] {
  const byName = new Map<string, SkillShortcutOption>()
  for (const option of [...memberOptions, ...configOptions]) {
    const name = option.name?.trim()
    if (!name) continue
    const current = byName.get(name)
    if (!current) {
      byName.set(name, {
        ...option,
        name,
        agents: [...(option.agents ?? [])],
      })
      continue
    }
    for (const agent of option.agents ?? []) {
      if (!current.agents?.some((item) => item.agent_id === agent.agent_id)) {
        current.agents = [...(current.agents ?? []), agent]
      }
    }
    if (!current.display_name && option.display_name) current.display_name = option.display_name
    if (!current.description && option.description) current.description = option.description
    if (!current.icon_url && option.icon_url) current.icon_url = option.icon_url
  }
  return [...byName.values()]
}

function parseChannelRuntimeSettings(settings: string | undefined): ChannelRuntimeSettings {
  if (!settings) return {}
  try {
    const parsed = JSON.parse(settings) as ChannelRuntimeSettings
    return {
      welcome_title: typeof parsed.welcome_title === 'string' ? parsed.welcome_title.trim() : undefined,
      welcome_message: typeof parsed.welcome_message === 'string' ? parsed.welcome_message.trim() : undefined,
      quick_questions: Array.isArray(parsed.quick_questions)
        ? parsed.quick_questions.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean)
        : undefined,
    }
  } catch {
    return {}
  }
}
