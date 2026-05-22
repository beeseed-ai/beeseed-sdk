import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import { Square } from 'lucide-react'
import type { ChatMessage, StreamState, AgentLoopState, AgentLoopEventItem, ChannelMemberInfo } from '../../core/types.js'
import { MessageBubble } from './MessageBubble.js'
import { ToolGroupBubble } from './ToolGroupBubble.js'
import { StreamRenderer } from './StreamRenderer.js'
import { AgentRunTranscript } from './AgentRunTranscript.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'
import { Button } from '../ui/button.js'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog.js'
import { stripStorageReferenceBlock } from '../../lib/storage-ref.js'

const CHAT_MAX_WIDTH = 820

type TimelineInput =
  | { kind: 'message'; message: ChatMessage; timestamp: number; order: number; messageId?: number }
  | { kind: 'agent_event'; loop: AgentLoopState; event: AgentLoopEventItem; timestamp: number; order: number; messageId?: number }
  | { kind: 'legacy_loop'; loop: AgentLoopState; timestamp: number; order: number }

type TimelineGroup =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'tool_group'; messages: ChatMessage[] }
  | { kind: 'agent_loop'; key: string; loop: AgentLoopState; events: AgentLoopEventItem[]; finalMessage?: ChatMessage }

interface Props {
  channelId: string
  messages: ChatMessage[]
  stream?: StreamState
  streams?: StreamState[]
  agentLoop?: AgentLoopState
  agentLoops?: AgentLoopState[]
  members?: ChannelMemberInfo[]
  typing?: string
  typings?: string[]
  onQuote?: (message: ChatMessage) => void
  onMentionClick?: (name: string) => void
  currentUserId?: string
  onSubmitAnswer?: (askId: string, answers: Record<string, unknown>) => void
  onStopAgent?: (agentId: string, reason?: string, runId?: string) => void
  welcomeMessage?: string
  className?: string
}

function agentLoopActivityAt(loop: AgentLoopState): number {
  let latest = loop.completedAt ?? loop.startedAt ?? 0
  for (const event of loop.events ?? []) {
    latest = Math.max(latest, event.timestamp)
  }
  for (const turn of loop.turns) {
    latest = Math.max(latest, turn.completedAt ?? turn.startedAt ?? 0)
    for (const tool of turn.toolCalls) {
      latest = Math.max(latest, tool.completedAt ?? tool.startedAt ?? 0)
    }
  }
  return latest
}

function agentLoopKey(loop: AgentLoopState): string {
  return `${loop.agentId}:${loop.runId || loop.startedAt}`
}

function agentDisplayName(members: ChannelMemberInfo[] | undefined, agentId: string) {
  const member = members?.find((m) => m.agent_id === agentId)
  return member?.display_name || agentId
}

function memberDisplayName(member: ChannelMemberInfo): string {
  return member.display_name || member.nickname || member.agent_id || member.user_id || 'unknown'
}

function displayMemberForMessage(members: ChannelMemberInfo[] | undefined, message: ChatMessage): ChannelMemberInfo | undefined {
  if (!members?.length || !message.senderId) return undefined
  if (message.senderType === 'agent' || message.isAgent) {
    return members.find((member) => member.member_type === 'agent' && member.agent_id === message.senderId)
  }
  if (message.senderType === 'user') {
    return members.find((member) => member.member_type === 'user' && member.user_id === message.senderId)
  }
  return undefined
}

function applyMemberDisplay(messages: ChatMessage[], members: ChannelMemberInfo[] | undefined): ChatMessage[] {
  if (!members?.length) return messages
  const agentNames = new Map(
    members
      .filter((member) => member.member_type === 'agent' && member.agent_id)
      .map((member) => [member.agent_id!, memberDisplayName(member)]),
  )

  return messages.map((message) => {
    const member = displayMemberForMessage(members, message)
    const selectedSkills = message.selectedSkills?.map((skill) => {
      const agentName = agentNames.get(skill.agent_id)
      return agentName && agentName !== skill.agent_name ? { ...skill, agent_name: agentName } : skill
    })
    if (!member) {
      return selectedSkills && selectedSkills !== message.selectedSkills ? { ...message, selectedSkills } : message
    }
    const senderName = memberDisplayName(member)
    const senderAvatarUrl = member.avatar_url
    if (message.senderName === senderName && message.senderAvatarUrl === senderAvatarUrl && selectedSkills === message.selectedSkills) {
      return message
    }
    return { ...message, senderName, senderAvatarUrl, selectedSkills }
  })
}

function normalizedAgentLoopText(content?: string): string {
  return stripStorageReferenceBlock(content ?? '').replace(/\s+/g, ' ').trim()
}

function isAgentLoopFinalMessage(message: ChatMessage, loop: AgentLoopState): boolean {
  if (loop.status !== 'completed' || message.role !== 'assistant') return false
  if (message.senderId !== loop.agentId) return false
  if (loop.runId && message.agentRunId && message.agentRunId !== loop.runId) return false
  const finalContent = normalizedAgentLoopText(loop.finalContent)
  if (finalContent && normalizedAgentLoopText(message.content) !== finalContent) return false
  return true
}

function sameAgentRun(a: { agentId: string; runId?: string }, b: { agentId: string; runId?: string }): boolean {
  if (a.agentId !== b.agentId) return false
  if (a.runId && b.runId && a.runId !== b.runId) return false
  return true
}

function messageTimelineOrder(message: ChatMessage, index: number): number {
  return message.msgId ? message.msgId * 10 : Number.MAX_SAFE_INTEGER - 10_000 + index
}

function agentEventTimelineOrder(event: AgentLoopEventItem, index: number): number {
  if (event.messageId) return event.messageId * 10 + 1
  if (event.seq) return Number.MAX_SAFE_INTEGER / 2 + event.seq
  return Number.MAX_SAFE_INTEGER - 5_000 + index
}

function sortTimelineItems(items: TimelineInput[]): TimelineInput[] {
  return [...items].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    const aMessageId = 'messageId' in a ? a.messageId ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
    const bMessageId = 'messageId' in b ? b.messageId ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
    if (aMessageId !== bMessageId) return aMessageId - bMessageId
    return a.order - b.order
  })
}

function matchingFinalLoop(message: ChatMessage, loops: AgentLoopState[]): AgentLoopState | undefined {
  for (const loop of loops) {
    if (isAgentLoopFinalMessage(message, loop)) return loop
  }
  return undefined
}

function appendToolMessage(groups: TimelineGroup[], message: ChatMessage) {
  const last = groups[groups.length - 1]
  if (last?.kind === 'tool_group') {
    last.messages.push(message)
    return
  }
  groups.push({ kind: 'tool_group', messages: [message] })
}

function buildTimelineGroups(messages: ChatMessage[], loops: AgentLoopState[]): TimelineGroup[] {
  const inputs: TimelineInput[] = []
  messages.forEach((message, index) => {
    inputs.push({
      kind: 'message',
      message,
      timestamp: message.timestamp,
      order: messageTimelineOrder(message, index),
      messageId: message.msgId,
    })
  })

  loops.forEach((loop, loopIndex) => {
    if (loop.events?.length) {
      loop.events.forEach((event, eventIndex) => {
        inputs.push({
          kind: 'agent_event',
          loop,
          event,
          timestamp: event.timestamp,
          order: agentEventTimelineOrder(event, eventIndex),
          messageId: event.messageId,
        })
      })
      return
    }
    if (loop.turns.length > 0) {
      inputs.push({
        kind: 'legacy_loop',
        loop,
        timestamp: agentLoopActivityAt(loop),
        order: Number.MAX_SAFE_INTEGER / 2 + loopIndex,
      })
    }
  })

  const groups: TimelineGroup[] = []
  for (const item of sortTimelineItems(inputs)) {
    if (item.kind === 'agent_event') {
      const last = groups[groups.length - 1]
      const key = agentLoopKey(item.loop)
      if (last?.kind === 'agent_loop' && sameAgentRun(last.loop, item.loop)) {
        last.events.push(item.event)
      } else {
        groups.push({ kind: 'agent_loop', key, loop: item.loop, events: [item.event] })
      }
      continue
    }

    if (item.kind === 'legacy_loop') {
      const last = groups[groups.length - 1]
      const key = agentLoopKey(item.loop)
      if (last?.kind === 'agent_loop' && sameAgentRun(last.loop, item.loop)) {
        last.loop = item.loop
      } else {
        groups.push({ kind: 'agent_loop', key, loop: item.loop, events: [] })
      }
      continue
    }

    const { message } = item
    if (message.role === 'tool' && message.toolName !== 'ask_user') {
      appendToolMessage(groups, message)
      continue
    }

    const finalLoop = matchingFinalLoop(message, loops)
    const last = groups[groups.length - 1]
    if (finalLoop && last?.kind === 'agent_loop' && sameAgentRun(last.loop, finalLoop)) {
      last.finalMessage = message
      last.loop = finalLoop
      continue
    }

    groups.push({ kind: 'message', message })
  }
  return groups
}

function AgentLoopBlock({ loop, members, finalMessage, events, showTerminal = true, onStop }: {
  loop: AgentLoopState
  members?: ChannelMemberInfo[]
  finalMessage?: ChatMessage
  events?: AgentLoopEventItem[]
  showTerminal?: boolean
  onStop?: (agentId: string, reason?: string, runId?: string) => void
}) {
  const [stopOpen, setStopOpen] = useState(false)
  const [stopReason, setStopReason] = useState('')
  const member = members?.find((m) => m.agent_id === loop.agentId)
  const agentName = agentDisplayName(members, loop.agentId)
  const canStop = loop.status === 'running' && !!onStop
  const handleStop = () => {
    onStop?.(loop.agentId, stopReason, loop.runId)
    setStopOpen(false)
    setStopReason('')
  }
  return (
    <div className="flex gap-2.5 py-2.5">
      <Avatar className="mt-0.5 size-9 shrink-0">
        {member?.avatar_url ? <AvatarImage src={member.avatar_url} /> : null}
        <AvatarFallback className="text-xs">AI</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs text-[#777169]">{agentName}</span>
          {canStop && (
            <button
              type="button"
              title="停止任务"
              aria-label="停止任务"
              onClick={() => setStopOpen(true)}
              className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
            >
              <Square className="size-3" />
            </button>
          )}
        </div>
        {canStop && (
          <Dialog open={stopOpen} onOpenChange={setStopOpen}>
            <DialogContent onClose={() => setStopOpen(false)}>
              <DialogHeader>
                <DialogTitle>停止任务</DialogTitle>
                <DialogDescription>可以补充一句原因，团队成员会在时间线里看到。</DialogDescription>
              </DialogHeader>
              <textarea
                value={stopReason}
                onChange={(event) => setStopReason(event.target.value)}
                placeholder="例如：方向不对，先停一下"
                maxLength={120}
                autoFocus
                className="mt-4 min-h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setStopOpen(false)}>取消</Button>
                <Button type="button" variant="destructive" onClick={handleStop}>停止任务</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <AgentRunTranscript loop={loop} finalMessage={finalMessage} events={events} showTerminal={showTerminal} />
      </div>
    </div>
  )
}

export function MessageList({
  channelId,
  messages,
  stream,
  streams,
  agentLoop,
  agentLoops,
  members,
  typing,
  typings,
  onQuote,
  onMentionClick,
  currentUserId,
  onSubmitAnswer,
  onStopAgent,
  welcomeMessage,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const visibleLoops = useMemo(() => agentLoops ?? (agentLoop ? [agentLoop] : []), [agentLoop, agentLoops])
  const displayMessages = useMemo(() => applyMemberDisplay(messages, members), [messages, members])
  const timelineGroups = useMemo(() => buildTimelineGroups(displayMessages, visibleLoops), [displayMessages, visibleLoops])
  const loopGroupLastIndexes = useMemo(() => {
    const indexes = new Map<string, number>()
    timelineGroups.forEach((group, index) => {
      if (group.kind === 'agent_loop') indexes.set(group.key, index)
    })
    return indexes
  }, [timelineGroups])
  const runningTimelineLoops = useMemo(() => timelineGroups.some((group) => (
    group.kind === 'agent_loop' && group.loop.status === 'running'
  )), [timelineGroups])
  const visibleStreams = useMemo(() => (
    (streams ?? (stream ? [stream] : []))
      .filter((activeStream) => {
        if (activeStream.agentLoop && activeStream.agentLoop.status !== 'running') return false
        if (activeStream.agentLoop?.status === 'completed' && activeStream.agentLoop.finalContent) return false
        if (activeStream.agentLoop?.events?.length) return false
        return true
      })
  ), [stream, streams])
  const visibleTypings = useMemo(() => typings ?? (typing ? [typing] : []), [typing, typings])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (el) { el.scrollTop = el.scrollHeight }
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current) { scrollToBottom(); requestAnimationFrame(scrollToBottom) }
  }, [
    timelineGroups.length,
    visibleLoops.map((loop) => `${agentLoopKey(loop)}:${agentLoopActivityAt(loop)}:${loop.events?.length ?? 0}`).join('|'),
    visibleStreams.map((s) => `${s.runId || s.agentId}:${s.content.length}:${s.agentLoop ? agentLoopActivityAt(s.agentLoop) : 0}`).join('|'),
    visibleTypings.join('|'),
    scrollToBottom,
  ])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  const handleScrollToMessage = useCallback((msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-yellow-50')
      setTimeout(() => el.classList.remove('bg-yellow-50'), 1500)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#fafafa]"
    >
      <div className="mx-auto w-full" style={{ maxWidth: CHAT_MAX_WIDTH }}>
        {timelineGroups.length === 0 && visibleStreams.length === 0 && visibleTypings.length === 0 && (
          <div className="flex min-h-[calc(100dvh-190px)] items-center justify-center px-6 text-center">
            <p className="max-w-md rounded-xl border border-border bg-white px-6 py-5 text-sm leading-6 text-muted-foreground shadow-sm">{welcomeMessage}</p>
          </div>
        )}

        {timelineGroups.length > 0 && (
          <div className="flex flex-col justify-end min-h-full px-4 py-3 gap-1 overflow-x-hidden max-w-full">
            {timelineGroups.map((group, i) => {
              if (group.kind === 'tool_group') {
                return <ToolGroupBubble key={`tg-${i}`} messages={group.messages} />
              }
              if (group.kind === 'agent_loop') {
                const isLastLoopGroup = loopGroupLastIndexes.get(group.key) === i
                const hasSeparateFinalMessage = group.loop.status === 'completed'
                  && !!group.loop.finalContent
                  && !group.finalMessage
                return (
                  <AgentLoopBlock
                    key={`loop-${group.key}-${i}`}
                    loop={group.loop}
                    members={members}
                    finalMessage={group.finalMessage}
                    events={group.events}
                    showTerminal={!!group.finalMessage || (isLastLoopGroup && !hasSeparateFinalMessage)}
                    onStop={onStopAgent}
                  />
                )
              }
              const item = group.message
              return (
                <MessageBubble
                  key={item.msgId ?? `m-${i}`}
                  message={item}
                  isOwn={item.role === 'user'}
                  channelId={channelId}
                  currentUserId={currentUserId}
                  onQuote={onQuote}
                  onMentionClick={onMentionClick}
                  onScrollToMessage={handleScrollToMessage}
                  onSubmitAnswer={onSubmitAnswer}
                />
              )
            })}
          </div>
        )}

        {/* Streaming */}
        {visibleStreams.map((activeStream) => {
          const activeLoop = activeStream.agentLoop ?? visibleLoops.find((loop) => (
            loop.agentId === activeStream.agentId
            && (activeStream.runId ? loop.runId === activeStream.runId : true)
            && loop.status === 'running'
          ))
          const agent = members?.find(m => m.agent_id === activeStream.agentId)
          return (
            <div key={`stream-${activeStream.agentId}-${activeStream.runId || activeStream.agentLoop?.runId || 'legacy'}`} className="px-4 pb-3 mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
              <StreamRenderer
                stream={activeStream}
                agentLoop={activeLoop}
                agentAvatarUrl={agent?.avatar_url}
                agentDisplayName={agent?.display_name}
                onStop={onStopAgent}
              />
            </div>
          )
        })}

        {/* Typing indicator */}
        {visibleTypings.length > 0 && visibleStreams.length === 0 && !runningTimelineLoops && visibleTypings.map((text, i) => (
          <div key={`typing-${i}-${text}`} className="flex items-center gap-2 px-16 py-2 text-[#999] text-xs mx-auto" style={{ maxWidth: CHAT_MAX_WIDTH }}>
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#999] [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#999] [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#999] [animation-delay:300ms]" />
            </span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
