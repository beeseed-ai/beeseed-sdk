import { useState, type ReactNode } from 'react'
import { Check, ChevronRight, Circle, Clock3, Sparkles, Wrench } from 'lucide-react'
import type { AgentLoopState, AgentLoopToolCall, AgentLoopSkillUse, ChatMessage, AgentLoopEventItem } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import { SkillIcon } from '../skills/SkillIcon.js'

interface Props {
  loop: AgentLoopState
  finalMessage?: ChatMessage
  events?: AgentLoopEventItem[]
  showContent?: 'all' | 'intermediate' | 'none'
  showTerminal?: boolean
  displayError?: string
  terminalAction?: ReactNode
  className?: string
}

function elapsedSeconds(startedAt?: number, completedAt?: number): string | null {
  if (!startedAt || !completedAt || completedAt < startedAt) return null
  return `${((completedAt - startedAt) / 1000).toFixed(1)}s`
}

function oneLine(value?: string): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function sameText(a?: string, b?: string): boolean {
  return oneLine(a) !== '' && oneLine(a) === oneLine(b)
}

function truncate(value: unknown, maxLen: number): string {
  if (typeof value === 'string') {
    const compact = value.replace(/\n/g, '↵')
    return compact.length > maxLen ? `${compact.slice(0, maxLen)}...` : compact
  }
  const text = JSON.stringify(value) ?? ''
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text
}

function outputSummary(value?: string): string {
  const text = oneLine(value)
  if (!text) return ''
  return text.length > 120 ? `${text.slice(0, 120)}...` : text
}

function TranscriptLine({
  icon,
  children,
  className,
}: {
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2 py-1', className)}>
      <div className="mt-0.5 flex size-[18px] items-center justify-center text-[#777169]">{icon}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function StatusDot({ status }: { status: AgentLoopToolCall['status'] }) {
  return (
    <span
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        status === 'calling' && 'animate-pulse bg-yellow-500',
        status === 'success' && 'bg-green-500',
        status === 'failed' && 'bg-red-500',
      )}
    />
  )
}

function SkillLine({ skill }: { skill: AgentLoopSkillUse }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const failed = skill.status === 'missing' || skill.status === 'error'
  const label = skill.displayName || skill.name

  return (
    <TranscriptLine
      icon={(
        <SkillIcon
          name={skill.name}
          iconUrl={skill.iconUrl}
          className={cn('size-[18px] rounded bg-transparent', failed ? 'text-red-600' : 'text-[#254fad]')}
          fallback={<Sparkles className="size-3.5" />}
        />
      )}
    >
      <button
        type="button"
        onClick={() => setDetailOpen((open) => !open)}
        className="flex min-h-6 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs text-[#555] hover:bg-black/[0.04]"
      >
        <ChevronRight className={cn('size-3 shrink-0 text-[#999] transition-transform', detailOpen && 'rotate-90')} />
        <span className="min-w-0 truncate font-medium text-[#181d26]">{label}</span>
        <span className="shrink-0">{failed ? '不可用' : '已启用'}</span>
        <span className="shrink-0 rounded border border-[#dddddd] px-1.5 py-0.5 text-[10px] leading-3 text-[#777169]">
          {skill.status}
        </span>
      </button>
      {detailOpen && (
        <div className="ml-5 mt-1 space-y-1 border-l-2 border-[#dddddd] pl-2 text-[11px] leading-4">
          <div className="font-mono text-[#181d26]">{skill.name}</div>
          {skill.description && <div className="text-[#555]">{skill.description}</div>}
          {skill.reason && <div className="text-muted-foreground">原因：{skill.reason}</div>}
        </div>
      )}
    </TranscriptLine>
  )
}

function ToolLine({ tool }: { tool: AgentLoopToolCall }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const hasDetail = !!tool.args || !!tool.output
  const duration = elapsedSeconds(tool.startedAt, tool.completedAt)
  const summary = outputSummary(tool.output)

  return (
    <TranscriptLine icon={<StatusDot status={tool.status} />}>
      <button
        type="button"
        onClick={hasDetail ? () => setDetailOpen((open) => !open) : undefined}
        className={cn(
          'flex min-h-6 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs text-[#555]',
          hasDetail && 'hover:bg-black/[0.04]',
        )}
      >
        {hasDetail ? (
          <ChevronRight className={cn('size-3 shrink-0 text-[#999] transition-transform', detailOpen && 'rotate-90')} />
        ) : (
          <span className="size-3 shrink-0" />
        )}
        {tool.parallel && <span className="shrink-0 text-[10px] text-[#999]">并行</span>}
        <span className="shrink-0 font-mono text-[#181d26]">{tool.name}</span>
        <span className="shrink-0">{tool.status === 'calling' ? '调用中' : tool.status === 'success' ? '完成' : '失败'}</span>
        {duration && <span className="shrink-0 text-[#999]">{duration}</span>}
        {summary && <span className="min-w-0 truncate text-[#777169]">{summary}</span>}
      </button>
      {detailOpen && (
        <div className="ml-5 mt-1 space-y-1 border-l-2 border-[#dddddd] pl-2 text-[11px] leading-4">
          {tool.args && (
            <div className="space-y-0.5">
              {Object.entries(tool.args).map(([key, value]) => (
                <div key={key} className="flex gap-1.5">
                  <span className="shrink-0 text-muted-foreground">{key}:</span>
                  <span className="break-all font-mono whitespace-pre-wrap text-foreground">{truncate(value, 300)}</span>
                </div>
              ))}
            </div>
          )}
          {tool.output && (
            <pre className="max-h-[220px] overflow-y-auto whitespace-pre-wrap break-all font-mono text-foreground">
              {tool.output.length > 2000 ? `${tool.output.slice(0, 2000)}\n...(truncated)` : tool.output}
            </pre>
          )}
        </div>
      )}
    </TranscriptLine>
  )
}

function ToolCallEventLine({ tool }: { tool: AgentLoopToolCall }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const hasArgs = !!tool.args
  return (
    <TranscriptLine icon={<StatusDot status={tool.status === 'failed' ? 'failed' : 'calling'} />}>
      <button
        type="button"
        onClick={hasArgs ? () => setDetailOpen((open) => !open) : undefined}
        className={cn(
          'flex min-h-6 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs text-[#555]',
          hasArgs && 'hover:bg-black/[0.04]',
        )}
      >
        {hasArgs ? (
          <ChevronRight className={cn('size-3 shrink-0 text-[#999] transition-transform', detailOpen && 'rotate-90')} />
        ) : (
          <span className="size-3 shrink-0" />
        )}
        {tool.parallel && <span className="shrink-0 text-[10px] text-[#999]">并行</span>}
        <span className="shrink-0 font-mono text-[#181d26]">{tool.name}</span>
        <span className="shrink-0">调用工具</span>
      </button>
      {detailOpen && tool.args && (
        <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-[#dddddd] pl-2 text-[11px] leading-4">
          {Object.entries(tool.args).map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <span className="shrink-0 text-muted-foreground">{key}:</span>
              <span className="break-all font-mono whitespace-pre-wrap text-foreground">{truncate(value, 300)}</span>
            </div>
          ))}
        </div>
      )}
    </TranscriptLine>
  )
}

function ToolResultEventLine({ tool }: { tool: AgentLoopToolCall }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const hasOutput = !!tool.output
  const duration = elapsedSeconds(tool.startedAt, tool.completedAt)
  const summary = outputSummary(tool.output)
  return (
    <TranscriptLine icon={<StatusDot status={tool.status} />}>
      <button
        type="button"
        onClick={hasOutput ? () => setDetailOpen((open) => !open) : undefined}
        className={cn(
          'flex min-h-6 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs text-[#555]',
          hasOutput && 'hover:bg-black/[0.04]',
        )}
      >
        {hasOutput ? (
          <ChevronRight className={cn('size-3 shrink-0 text-[#999] transition-transform', detailOpen && 'rotate-90')} />
        ) : (
          <span className="size-3 shrink-0" />
        )}
        <span className="shrink-0 font-mono text-[#181d26]">{tool.name}</span>
        <span className="shrink-0">{tool.status === 'success' ? '结果完成' : '结果失败'}</span>
        {duration && <span className="shrink-0 text-[#999]">{duration}</span>}
        {summary && <span className="min-w-0 truncate text-[#777169]">{summary}</span>}
      </button>
      {detailOpen && tool.output && (
        <pre className="ml-5 mt-1 max-h-[220px] overflow-y-auto whitespace-pre-wrap break-all border-l-2 border-[#dddddd] pl-2 font-mono text-[11px] leading-4 text-foreground">
          {tool.output.length > 2000 ? `${tool.output.slice(0, 2000)}\n...(truncated)` : tool.output}
        </pre>
      )}
    </TranscriptLine>
  )
}

function AssistantText({ content, streaming = false, final = false }: { content: string; streaming?: boolean; final?: boolean }) {
  return (
    <TranscriptLine
      icon={final ? <Check className="size-3.5 text-[#006400]" /> : <span className="mt-1 inline-flex size-1.5 rounded-full bg-[#181d26]/55" />}
      className={final ? 'pt-1.5' : undefined}
    >
      <div className="text-sm leading-6 text-[#181d26]">
        <MarkdownRenderer
          content={content}
          className="prose prose-sm max-w-none break-words [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_code.inline-code]:rounded [&_code.inline-code]:bg-[#f5f5f5] [&_code.inline-code]:px-1 [&_code.inline-code]:py-0.5"
        />
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-[#181d26]/50 align-text-bottom" />
        )}
      </div>
    </TranscriptLine>
  )
}

function TerminalLine({ loop, displayError, terminalAction }: { loop: AgentLoopState; displayError?: string; terminalAction?: ReactNode }) {
  const totalDuration = elapsedSeconds(loop.startedAt, loop.completedAt)
  if (loop.status === 'completed') {
    return (
      <TranscriptLine icon={<Check className="size-3.5 text-[#006400]" />}>
        <div className="flex min-h-6 items-center gap-1.5 text-xs">
          <span className="font-medium text-green-700">完成{totalDuration ? ` ${totalDuration}` : ''}</span>
        </div>
      </TranscriptLine>
    )
  }

  if (loop.status === 'max_turns_reached') {
    return (
      <TranscriptLine icon={<Wrench className="size-3.5 text-amber-600" />}>
        <span className="text-xs font-medium text-amber-700">已达到最大轮次 ({loop.currentTurn})</span>
      </TranscriptLine>
    )
  }

  if (loop.status === 'waiting_for_user') {
    return (
      <TranscriptLine icon={<span className="inline-flex size-2 animate-pulse rounded-full bg-amber-500" />}>
        <span className="text-xs font-medium text-amber-700">等待用户回答</span>
      </TranscriptLine>
    )
  }

  const label =
    loop.status === 'error' ? '错误'
      : loop.status === 'stopped' ? '已停止'
        : loop.status === 'interrupted' ? '已中断'
          : loop.status === 'waiting_expired' ? '等待已超时'
            : loop.status
  const tone =
    loop.status === 'error' ? 'text-red-700'
      : loop.status === 'interrupted' || loop.status === 'waiting_expired' ? 'text-amber-700'
        : 'text-zinc-700'
  const dot =
    loop.status === 'error' ? 'fill-red-600 text-red-600'
      : loop.status === 'interrupted' || loop.status === 'waiting_expired' ? 'fill-amber-500 text-amber-500'
        : 'fill-zinc-400 text-zinc-400'

  return (
    <>
      <TranscriptLine icon={<Circle className={cn('size-3.5', dot)} />}>
        <div className="flex min-h-6 items-start gap-1.5 text-xs">
          <span className={cn('shrink-0 font-medium', tone)}>{label}</span>
          {displayError && <span className="min-w-0 leading-5 text-muted-foreground">{displayError}</span>}
        </div>
      </TranscriptLine>
      {terminalAction}
    </>
  )
}

function renderEventItem(item: AgentLoopEventItem, loop: AgentLoopState, finalAnswer: string) {
  if (item.type === 'assistant_content' && item.content && !sameText(item.content, finalAnswer)) {
    return <AssistantText key={item.id} content={item.content} streaming={loop.status === 'running'} />
  }
  if (item.type === 'progress' && item.summary && !sameText(item.summary, finalAnswer)) {
    return (
      <TranscriptLine key={item.id} icon={<Clock3 className="size-3.5 text-[#999]" />}>
        <div className="text-xs leading-5 text-[#555]">{item.summary}</div>
      </TranscriptLine>
    )
  }
  if (item.type === 'skill_use' && item.skill) {
    return <SkillLine key={item.id} skill={item.skill} />
  }
  if (item.type === 'tool_call' && item.tool) {
    return <ToolCallEventLine key={item.id} tool={item.tool} />
  }
  if (item.type === 'tool_result' && item.tool) {
    return <ToolResultEventLine key={item.id} tool={item.tool} />
  }
  return null
}

export function AgentRunTranscript({
  loop,
  finalMessage,
  events,
  showContent = 'all',
  showTerminal = true,
  displayError,
  terminalAction,
  className,
}: Props) {
  const isRunning = loop.status === 'running'
  const finalAnswer = loop.finalContent || finalMessage?.content || ''
  const finalTurnNumber = finalAnswer && loop.status === 'completed'
    ? loop.turns[loop.turns.length - 1]?.turnNumber
    : undefined
  const terminalError = displayError ?? loop.error
  const hasFinalAnswer = loop.status === 'completed' && finalAnswer.trim() !== ''
  const orderedEvents = events?.length ? events : loop.events?.length ? loop.events : undefined
  const shouldCollapseProcess = !isRunning && hasFinalAnswer
  const [processOpen, setProcessOpen] = useState(false)
  const hasProcess = orderedEvents ? orderedEvents.length > 0 : loop.turns.some((turn) => (
    turn.thinking
    || turn.content
    || turn.progress
    || (turn.skillUses ?? []).length > 0
    || (turn.toolCalls ?? []).length > 0
  ))

  const processContent = orderedEvents ? orderedEvents.map((item) => renderEventItem(item, loop, finalAnswer)) : loop.turns.map((turn, index) => {
    const visibleContent = showContent === 'none'
      ? ''
      : showContent === 'intermediate' && turn.turnNumber === finalTurnNumber
        ? ''
        : turn.content || ''
    const shouldShowContent = visibleContent && !sameText(visibleContent, finalAnswer)
    const shouldShowProgress = turn.progress
      && !sameText(turn.progress, visibleContent)
      && !sameText(turn.progress, finalAnswer)
    const showTurnMarker = loop.turns.length > 1

    return (
      <div key={`${turn.turnNumber}-${index}`}>
        {showTurnMarker && (
          <TranscriptLine icon={<Circle className="size-3.5 text-muted-foreground/40" />} className="py-0.5">
            <span className="text-[11px] font-medium text-[#777169]">
              {turn.turnNumber === 1 ? '开始处理' : `继续处理 ${turn.turnNumber}`}
            </span>
          </TranscriptLine>
        )}

        {turn.thinking && (
          <TranscriptLine icon={<Clock3 className="size-3.5 text-[#777169]" />}>
            <div className="text-xs leading-5 text-[#555]">{turn.thinking}</div>
          </TranscriptLine>
        )}

        {shouldShowContent && (
          <AssistantText content={visibleContent} streaming={turn.status === 'active' && isRunning} />
        )}

        {(turn.skillUses ?? []).map((skill) => <SkillLine key={skill.id} skill={skill} />)}
        {(turn.toolCalls ?? []).map((tool) => <ToolLine key={tool.id} tool={tool} />)}

        {shouldShowProgress && (
          <TranscriptLine icon={<Clock3 className="size-3.5 text-[#999]" />}>
            <div className="text-xs leading-5 text-[#555]">{turn.progress}</div>
          </TranscriptLine>
        )}

        {turn.status === 'active' && isRunning && !turn.content && (turn.toolCalls ?? []).length === 0 && (
          <TranscriptLine icon={<span className="inline-flex size-2 animate-pulse rounded-full bg-[#181d26]/60" />}>
            <span className="text-xs text-[#777169]">等待 LLM 响应...</span>
          </TranscriptLine>
        )}
      </div>
    )
  })

  return (
    <div className={cn('space-y-0.5', className)}>
      {shouldCollapseProcess && hasProcess ? (
        <>
          <button
            type="button"
            onClick={() => setProcessOpen((open) => !open)}
            className="mb-1 flex min-h-6 items-center gap-2 rounded-md px-1.5 text-left text-xs text-[#777169] hover:bg-black/[0.04]"
          >
            <ChevronRight className={cn('size-3 shrink-0 text-[#999] transition-transform', processOpen && 'rotate-90')} />
            <span>{processOpen ? '收起处理过程' : '查看处理过程'}</span>
          </button>
          {processOpen && processContent}
        </>
      ) : processContent}

      {showTerminal && hasFinalAnswer ? (
        <AssistantText content={finalAnswer} final />
      ) : (
        showTerminal && loop.status !== 'running' && <TerminalLine loop={loop} displayError={terminalError} terminalAction={terminalAction} />
      )}
    </div>
  )
}
