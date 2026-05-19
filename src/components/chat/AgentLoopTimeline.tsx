import { useState } from 'react'
import { Check, ChevronRight, Circle, Clock3, Sparkles, Wrench } from 'lucide-react'
import type { AgentLoopState, AgentLoopTurn, AgentLoopToolCall, AgentLoopSkillUse, AgentTodoItem } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { ThinkingBlock } from './ThinkingBlock.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'

interface Props {
  loop: AgentLoopState
  showContent?: 'all' | 'intermediate' | 'none'
  className?: string
}

function TurnStatusIcon({ turn, isRunning }: { turn: AgentLoopTurn; isRunning: boolean }) {
  if (turn.status === 'active' && isRunning) {
    return (
      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex size-3 rounded-full bg-[#181d26]/15 animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-[#181d26]" />
      </span>
    )
  }
  if (turn.status === 'completed') {
    return <Check className="size-3.5 text-[#006400]" />
  }
  return <Circle className="size-3.5 text-muted-foreground/40" />
}

function ToolCallLine({ tool }: { tool: AgentLoopToolCall }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const dotColor =
    tool.status === 'calling' ? 'bg-yellow-500 animate-pulse' :
    tool.status === 'success' ? 'bg-green-500' :
    'bg-red-500'

  const hasDetail = !!tool.args || !!tool.output
  const duration = tool.completedAt && tool.startedAt
    ? ((tool.completedAt - tool.startedAt) / 1000).toFixed(1)
    : null

  return (
    <div className="py-0.5">
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-[#555]',
          hasDetail && 'cursor-pointer hover:bg-black/[0.04]',
        )}
        onClick={hasDetail ? () => setDetailOpen(!detailOpen) : undefined}
      >
        {hasDetail ? (
          <ChevronRight className={cn('size-3 shrink-0 transition-transform text-[#999]', detailOpen && 'rotate-90')} />
        ) : (
          <span className="size-3" />
        )}
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />
        {tool.parallel && <span className="text-[10px] text-[#999]">并行</span>}
        <span className="font-mono text-[#181d26]">{tool.name}</span>
        <span>{tool.status === 'calling' ? '调用中' : tool.status === 'success' ? '完成' : '失败'}</span>
        {duration && <span className="text-[#999]">{duration}s</span>}
      </div>

      {detailOpen && (
        <div className="ml-5 mt-1 mb-1 text-[11px] border-l-2 border-[#dddddd] pl-2">
          {tool.args && (
            <div className="space-y-0.5">
              {Object.entries(tool.args).map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <span className="text-muted-foreground shrink-0">{k}:</span>
                  <span className="text-foreground break-all font-mono whitespace-pre-wrap">
                    {truncate(v, 300)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {tool.output && (
            <pre className="text-foreground whitespace-pre-wrap break-all font-mono max-h-[200px] overflow-y-auto">
              {tool.output.length > 2000 ? tool.output.slice(0, 2000) + '\n…(truncated)' : tool.output}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function SkillUseLine({ skill }: { skill: AgentLoopSkillUse }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const failed = skill.status === 'missing' || skill.status === 'error'
  const label = skill.displayName || skill.name
  return (
    <div className="py-0.5">
      <div
        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-[#555] hover:bg-black/[0.04]"
        onClick={() => setDetailOpen(!detailOpen)}
      >
        <ChevronRight className={cn('size-3 shrink-0 transition-transform text-[#999]', detailOpen && 'rotate-90')} />
        <Sparkles className={cn('size-3 shrink-0', failed ? 'text-red-600' : 'text-[#254fad]')} />
        <span className="font-medium text-[#181d26]">{label}</span>
        <span>{failed ? '不可用' : '已启用'}</span>
        <span className="rounded border border-[#dddddd] px-1.5 py-0.5 text-[10px] text-[#777169]">{skill.status}</span>
      </div>
      {detailOpen && (
        <div className="ml-5 mt-1 mb-1 space-y-1 border-l-2 border-[#dddddd] pl-2 text-[11px]">
          <div className="font-mono text-[#181d26]">{skill.name}</div>
          {skill.description && <div className="leading-5 text-[#555]">{skill.description}</div>}
          {skill.reason && <div className="text-muted-foreground">原因：{skill.reason}</div>}
        </div>
      )}
    </div>
  )
}

function TodoStatusIcon({ todo }: { todo: AgentTodoItem }) {
  if (todo.status === 'completed') {
    return <Check className="size-3.5 text-[#006400]" />
  }
  if (todo.status === 'in_progress') {
    return (
      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex size-3 rounded-full bg-[#181d26]/15 animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-[#181d26]" />
      </span>
    )
  }
  if (todo.status === 'blocked') {
    return <Circle className="size-3.5 fill-amber-500 text-amber-500" />
  }
  if (todo.status === 'skipped') {
    return <Circle className="size-3.5 text-[#999]" />
  }
  return <Circle className="size-3.5 text-muted-foreground/40" />
}

function todoStatusLabel(status: AgentTodoItem['status']) {
  switch (status) {
    case 'in_progress': return '进行中'
    case 'completed': return '完成'
    case 'blocked': return '阻塞'
    case 'skipped': return '跳过'
    default: return '待处理'
  }
}

function AgentTodoList({ todos }: { todos?: AgentTodoItem[] }) {
  if (!todos || todos.length === 0) return null

  return (
    <div className="rounded-md bg-white px-2.5 py-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[#181d26]">
        <Clock3 className="size-3 text-[#777169]" />
        <span>执行 TODO</span>
      </div>
      <div className="space-y-0.5">
        {todos.map((todo) => (
          <div key={todo.id} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-start gap-2 rounded-md px-1 py-1 text-xs">
            <TodoStatusIcon todo={todo} />
            <div className="min-w-0">
              <div className={cn(
                'break-words leading-5 text-[#181d26]',
                todo.status === 'completed' && 'text-[#777169] line-through',
                todo.status === 'skipped' && 'text-[#999]',
              )}>
                {todo.title}
              </div>
              {(todo.evidence || todo.blocker) && (
                <div className="break-words text-[11px] leading-4 text-[#777169]">
                  {todo.blocker || todo.evidence}
                </div>
              )}
            </div>
            <span className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] leading-3',
              todo.status === 'in_progress' && 'border-[#181d26]/20 bg-[#181d26]/5 text-[#181d26]',
              todo.status === 'completed' && 'border-green-200 bg-green-50 text-green-700',
              todo.status === 'blocked' && 'border-amber-200 bg-amber-50 text-amber-700',
              todo.status === 'skipped' && 'border-[#dddddd] bg-[#f7f7f5] text-[#777169]',
              todo.status === 'pending' && 'border-[#dddddd] text-[#777169]',
            )}>
              {todoStatusLabel(todo.status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TurnItem({
  turn,
  isRunning,
  defaultOpen,
  showContent,
  isFinalTurn,
}: {
  turn: AgentLoopTurn
  isRunning: boolean
  defaultOpen: boolean
  showContent: 'all' | 'intermediate' | 'none'
  isFinalTurn: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const skillUses = turn.skillUses ?? []
  const toolCalls = turn.toolCalls ?? []
  const parallelBatches = groupParallelTools(toolCalls)
  const shouldShowContent = showContent === 'all' || (showContent === 'intermediate' && !isFinalTurn)
  const visibleContent = shouldShowContent ? turn.content : undefined
  const hasContent = turn.thinking || skillUses.length > 0 || toolCalls.length > 0 || turn.progress || visibleContent
  const label = turn.turnNumber === 1 ? '开始处理' : `继续处理 ${turn.turnNumber}`

  return (
    <div className="relative">
      {/* Turn header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-1 hover:bg-black/[0.04] rounded-md px-1 -mx-1 transition-colors"
      >
        <ChevronRight className={cn('size-3 text-[#999] transition-transform shrink-0', open && 'rotate-90')} />
        <TurnStatusIcon turn={turn} isRunning={isRunning} />
        <span className="text-xs font-medium text-[#181d26]">{label}</span>
        {!open && turn.progress && (
          <span className="text-[10px] text-[#777169] truncate">{turn.progress}</span>
        )}
        {!open && (skillUses.length > 0 || toolCalls.length > 0) && (
          <span className="text-[10px] text-[#999]">
            {skillUses.length > 0 ? `${skillUses.length} 个技能` : ''}
            {skillUses.length > 0 && toolCalls.length > 0 ? ' · ' : ''}
            {toolCalls.length > 0 ? `${toolCalls.length} 个工具` : ''}
          </span>
        )}
      </button>

      {/* Turn body */}
      {open && hasContent && (
        <div className="ml-[18px] pl-4 border-l border-[#dddddd]">
          {/* Thinking */}
          {turn.thinking && (
            <ThinkingBlock content={turn.thinking} isStreaming={turn.status === 'active' && isRunning} />
          )}

          {/* Assistant content for this loop turn. During streaming this lets the
              public answer and execution steps appear in the same flow. */}
          {visibleContent && (
            <div className="my-1.5 rounded-md bg-white px-3 py-2 text-sm text-[#181d26] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
              <MarkdownRenderer
                content={visibleContent}
                className="prose prose-sm max-w-none break-words [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_code.inline-code]:rounded [&_code.inline-code]:bg-[#f5f5f5] [&_code.inline-code]:px-1 [&_code.inline-code]:py-0.5"
              />
              {turn.status === 'active' && isRunning && (
                <span className="inline-block w-1.5 h-4 bg-[#181d26]/50 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          )}

          {/* Skills */}
          {skillUses.length > 0 && (
            <div className="mt-1">
              {skillUses.map((skill) => <SkillUseLine key={skill.id} skill={skill} />)}
            </div>
          )}

          {/* Tool calls */}
          {parallelBatches.map((batch, bi) => (
            <div key={bi}>
              {batch.parallel && batch.tools.length > 1 && (
                <div className="text-[10px] text-[#777169] flex items-center gap-1 mt-1 mb-0.5">
                  <span>∥</span>
                  <span>{batch.tools.length} 并行</span>
                </div>
              )}
              {batch.tools.map((tool) => (
                <ToolCallLine key={tool.id} tool={tool} />
              ))}
            </div>
          ))}

          {/* Progress */}
          {turn.progress && (
            <div className="flex items-center gap-1.5 py-1 text-[11px] text-[#555]">
              <Clock3 className="size-3 text-[#999]" />
              <span>{turn.progress}</span>
            </div>
          )}

          {/* Active indicator */}
          {turn.status === 'active' && isRunning && !turn.thinking && toolCalls.length === 0 && (
            <div className="flex items-center gap-1.5 py-1 text-xs text-[#777169]">
              <span className="inline-flex size-2 rounded-full bg-[#181d26]/60 animate-pulse" />
              <span>等待 LLM 响应...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AgentLoopTimeline({ loop, showContent = 'intermediate', className }: Props) {
  const isRunning = loop.status === 'running'
  const finalAnswerTurnNumber = loop.status === 'completed' && loop.finalContent
    ? loop.turns[loop.turns.length - 1]?.turnNumber
    : undefined

  return (
    <div className={cn('space-y-1', className)}>
      <AgentTodoList todos={loop.todos} />

      {loop.turns.map((turn, i) => (
        <TurnItem
          key={`${turn.turnNumber}-${i}`}
          turn={turn}
          isRunning={isRunning}
          defaultOpen={i === loop.turns.length - 1}
          showContent={showContent}
          isFinalTurn={turn.turnNumber === finalAnswerTurnNumber}
        />
      ))}

      {/* Terminal states */}
      {loop.status === 'completed' && loop.finalContent && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <Check className="size-3.5 text-[#006400]" />
          <span className="font-medium text-green-700">完成</span>
          <span className="text-muted-foreground truncate max-w-[300px]">{loop.finalContent.slice(0, 80)}</span>
        </div>
      )}

      {loop.status === 'max_turns_reached' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <Wrench className="size-3.5 text-amber-600" />
          <span className="font-medium text-amber-700">已达到最大轮次 ({loop.currentTurn})</span>
        </div>
      )}

      {loop.status === 'error' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <Circle className="size-3.5 text-red-600 fill-red-600" />
          <span className="font-medium text-red-700">错误</span>
          {loop.error && <span className="text-muted-foreground truncate max-w-[300px]">{loop.error}</span>}
        </div>
      )}

      {loop.status === 'stopped' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <Circle className="size-3.5 text-zinc-400 fill-zinc-400" />
          <span className="font-medium text-zinc-700">已停止</span>
          {loop.error && <span className="text-muted-foreground truncate max-w-[300px]">{loop.error}</span>}
        </div>
      )}

      {loop.status === 'interrupted' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <Circle className="size-3.5 text-amber-500 fill-amber-500" />
          <span className="font-medium text-amber-700">已中断</span>
          {loop.error && <span className="text-muted-foreground truncate max-w-[300px]">{loop.error}</span>}
        </div>
      )}

      {loop.status === 'waiting_for_user' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <span className="inline-flex size-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-medium text-amber-700">等待用户回答</span>
        </div>
      )}

      {loop.status === 'waiting_expired' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <Circle className="size-3.5 text-zinc-400 fill-zinc-400" />
          <span className="font-medium text-zinc-700">等待已超时</span>
          {loop.error && <span className="text-muted-foreground truncate max-w-[300px]">{loop.error}</span>}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──

function truncate(v: unknown, maxLen: number): string {
  if (typeof v === 'string') {
    const oneLine = v.replace(/\n/g, '↵')
    return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '…' : oneLine
  }
  const s = JSON.stringify(v)
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
}

interface ToolBatch {
  parallel: boolean
  tools: AgentLoopToolCall[]
}

function groupParallelTools(tools: AgentLoopToolCall[]): ToolBatch[] {
  const batches: ToolBatch[] = []
  let currentBatch: AgentLoopToolCall[] = []
  let currentParallel = false

  for (const tool of tools) {
    const isParallel = !!tool.parallel
    if (currentBatch.length === 0) {
      currentBatch.push(tool)
      currentParallel = isParallel
    } else if (isParallel === currentParallel && tool.batchId === currentBatch[0]!.batchId) {
      currentBatch.push(tool)
    } else {
      batches.push({ parallel: currentParallel, tools: [...currentBatch] })
      currentBatch = [tool]
      currentParallel = isParallel
    }
  }
  if (currentBatch.length > 0) {
    batches.push({ parallel: currentParallel, tools: currentBatch })
  }
  return batches
}
