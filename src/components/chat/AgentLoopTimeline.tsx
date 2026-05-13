import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { AgentLoopState, AgentLoopTurn, AgentLoopToolCall } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { ThinkingBlock } from './ThinkingBlock.js'

interface Props {
  loop: AgentLoopState
  className?: string
}

function TurnStatusIcon({ turn, isRunning }: { turn: AgentLoopTurn; isRunning: boolean }) {
  if (turn.status === 'active' && isRunning) {
    return <span className="inline-block w-2.5 h-2.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  }
  if (turn.status === 'completed') {
    return <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
  }
  return <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
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
          'flex items-center gap-2 text-xs text-muted-foreground',
          hasDetail && 'cursor-pointer hover:bg-muted/50 -mx-1 px-1 rounded',
        )}
        onClick={hasDetail ? () => setDetailOpen(!detailOpen) : undefined}
      >
        {hasDetail ? (
          <ChevronRight className={cn('w-3 h-3 shrink-0 transition-transform', detailOpen && 'rotate-90')} />
        ) : (
          <span className="w-3 h-3" />
        )}
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />
        {tool.parallel && <span className="text-[10px] text-muted-foreground/50">∥</span>}
        <span className="font-mono text-foreground">{tool.name}</span>
        <span>{tool.status === 'calling' ? '调用中' : tool.status === 'success' ? '完成' : '失败'}</span>
        {duration && <span className="opacity-50">{duration}s</span>}
      </div>

      {detailOpen && (
        <div className="ml-5 mt-1 mb-1 text-[11px] border-l-2 border-muted pl-2">
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

function TurnItem({ turn, isRunning, defaultOpen }: { turn: AgentLoopTurn; isRunning: boolean; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  const parallelBatches = groupParallelTools(turn.toolCalls)
  const hasContent = turn.thinking || turn.toolCalls.length > 0 || turn.progress || turn.content

  return (
    <div className="relative">
      {/* Turn header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-1 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
      >
        <ChevronRight className={cn('w-3 h-3 text-muted-foreground transition-transform shrink-0', open && 'rotate-90')} />
        <TurnStatusIcon turn={turn} isRunning={isRunning} />
        <span className="text-xs font-medium">Turn {turn.turnNumber}</span>
        {!open && turn.progress && (
          <span className="text-[10px] text-muted-foreground truncate">{turn.progress}</span>
        )}
        {!open && turn.toolCalls.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50">{turn.toolCalls.length} 工具调用</span>
        )}
      </button>

      {/* Turn body */}
      {open && hasContent && (
        <div className="ml-5 pl-3 border-l border-muted">
          {/* Thinking */}
          {turn.thinking && (
            <ThinkingBlock content={turn.thinking} isStreaming={turn.status === 'active' && isRunning} />
          )}

          {/* Tool calls */}
          {parallelBatches.map((batch, bi) => (
            <div key={bi}>
              {batch.parallel && batch.tools.length > 1 && (
                <div className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-1 mb-0.5">
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
            <div className="flex items-center gap-1.5 py-1 text-[11px] text-muted-foreground">
              <span>📊</span>
              <span>{turn.progress}</span>
            </div>
          )}

          {/* Turn content/result */}
          {turn.content && turn.status === 'completed' && (
            <div className="py-1 text-xs text-foreground/80 whitespace-pre-wrap line-clamp-3">
              {turn.content.slice(0, 200)}{turn.content.length > 200 ? '...' : ''}
            </div>
          )}

          {/* Active indicator */}
          {turn.status === 'active' && isRunning && !turn.thinking && turn.toolCalls.length === 0 && (
            <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
              <span className="inline-block w-2 h-2 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              <span>等待 LLM 响应...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AgentLoopTimeline({ loop, className }: Props) {
  const isRunning = loop.status === 'running'

  return (
    <div className={cn('space-y-0.5', className)}>
      {loop.turns.map((turn, i) => (
        <TurnItem
          key={turn.turnNumber}
          turn={turn}
          isRunning={isRunning}
          defaultOpen={i === loop.turns.length - 1}
        />
      ))}

      {/* Terminal states */}
      {loop.status === 'completed' && loop.finalContent && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="font-medium text-green-700">完成</span>
          <span className="text-muted-foreground truncate max-w-[300px]">{loop.finalContent.slice(0, 80)}</span>
        </div>
      )}

      {loop.status === 'max_turns_reached' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="font-medium text-amber-700">已达到最大轮次 ({loop.currentTurn})</span>
        </div>
      )}

      {loop.status === 'error' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="font-medium text-red-700">错误</span>
          {loop.error && <span className="text-muted-foreground truncate max-w-[300px]">{loop.error}</span>}
        </div>
      )}

      {loop.status === 'stopped' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
          <span className="font-medium text-zinc-700">已停止</span>
        </div>
      )}

      {loop.status === 'interrupted' && (
        <div className="flex items-center gap-1.5 py-1 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="font-medium text-amber-700">已中断</span>
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
