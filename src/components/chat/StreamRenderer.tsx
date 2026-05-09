import type { StreamState, AgentLoopState } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { Avatar, AvatarFallback } from '../ui/avatar.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import { ThinkingBlock } from './ThinkingBlock.js'
import { AgentLoopTimeline } from './AgentLoopTimeline.js'

interface Props {
  stream: StreamState
  agentLoop?: AgentLoopState
  className?: string
}

export function StreamRenderer({ stream, agentLoop, className }: Props) {
  const hasContent = stream.content || stream.thinking || stream.toolCall || agentLoop

  return (
    <div className={cn('flex gap-2 px-4 py-1', className)}>
      <Avatar className="size-7 shrink-0 mt-0.5">
        <AvatarFallback className="text-xs">🤖</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-0.5 max-w-[85%]">
        <span className="text-xs text-muted-foreground">{stream.agentId}</span>

        {/* Agent Loop timeline (replaces simple turn indicator) */}
        {agentLoop && agentLoop.turns.length > 0 && (
          <div className="rounded-lg bg-muted px-3 py-2 min-w-[280px]">
            <AgentLoopTimeline loop={agentLoop} />
          </div>
        )}

        {/* Thinking (only when no agent loop, otherwise ThinkingBlock is inside AgentLoopTimeline) */}
        {!agentLoop && stream.thinking && (
          <ThinkingBlock content={stream.thinking} isStreaming />
        )}

        {/* Tool call indicator (only when no agent loop) */}
        {!agentLoop && stream.toolCall && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs bg-muted border border-border text-muted-foreground">
            <span className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              stream.toolCall.status === 'calling' ? 'bg-yellow-500 animate-pulse' :
              stream.toolCall.status === 'success' ? 'bg-green-500' :
              stream.toolCall.status === 'failed' ? 'bg-red-500' :
              'bg-yellow-500 animate-pulse',
            )} />
            <span className="font-mono">{stream.toolCall.name}</span>
          </div>
        )}

        {/* Streaming content */}
        {stream.content && (
          <div className="rounded-lg px-3 py-2 text-sm bg-muted text-foreground break-words">
            <MarkdownRenderer content={stream.content} />
            <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
          </div>
        )}

        {/* Empty state */}
        {!hasContent && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-2.5 h-2.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            <span>正在处理...</span>
          </div>
        )}
      </div>
    </div>
  )
}
