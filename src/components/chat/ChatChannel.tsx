import { useMemo, useState, useCallback } from 'react'
import type { ChannelMemberInfo, ChannelRuntimeSettings, ChatMessage, SkillShortcutAgent, SkillShortcutOption } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useAppConfig } from '../../hooks/use-app-config.js'
import { useChannels } from '../../hooks/use-channels.js'
import { useChat } from '../../hooks/use-chat.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
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
  const { branding } = useAppConfig()
  const { channels } = useChannels()
  const { messages, streams, agentLoops, members, typings, send, sendWithQuote, submitAnswer, stopAgent, loading } = useChat(channelId)
  const { composerInsertText, consumeComposerInsert, openWorkflowRun } = useDetailPanel()
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null)
  const channelSettings = useMemo(
    () => parseChannelRuntimeSettings(channels.find((channel) => channel.id === channelId)?.settings),
    [channels, channelId],
  )
  const welcomeTitle = channelSettings.welcome_title
  const welcomeMessage = channelSettings.welcome_message || branding.welcomeMessage
  const quickQuestions = channelSettings.quick_questions ?? []
  const skillOptions = useMemo(() => buildSkillOptionsFromMembers(members), [members])

  const handleSend = useCallback((content: string, metadata?: Record<string, unknown>) => {
    if (quotedMessage) {
      sendWithQuote(content, quotedMessage, metadata)
      setQuotedMessage(null)
    } else {
      send(content, metadata)
    }
  }, [quotedMessage, send, sendWithQuote])

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
              insertText={composerInsertText}
              onInsertTextConsumed={consumeComposerInsert}
              skillOptions={skillOptions}
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
