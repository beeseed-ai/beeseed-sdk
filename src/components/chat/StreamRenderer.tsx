import { useState } from 'react'
import type { StreamState, AgentLoopState } from '../../core/types.js'
import { Square } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar.js'
import { Button } from '../ui/button.js'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import { ThinkingBlock } from './ThinkingBlock.js'
import { AgentLoopTimeline } from './AgentLoopTimeline.js'

interface Props {
  stream: StreamState
  agentLoop?: AgentLoopState
  agentAvatarUrl?: string
  agentDisplayName?: string
  onStop?: (agentId: string, reason?: string, runId?: string) => void
  className?: string
}

export function StreamRenderer({ stream, agentLoop, agentAvatarUrl, agentDisplayName, onStop, className }: Props) {
  const [stopOpen, setStopOpen] = useState(false)
  const [stopReason, setStopReason] = useState('')
  const hasContent = stream.content || stream.thinking || stream.toolCall || agentLoop
  const displayName = agentDisplayName || stream.agentId

  const handleStop = () => {
    onStop?.(stream.agentId, stopReason, stream.runId || agentLoop?.runId)
    setStopOpen(false)
    setStopReason('')
  }

  return (
    <div className={cn('flex gap-2.5 py-2.5', className)}>
      <Avatar className="size-9 shrink-0 mt-0.5">
        {agentAvatarUrl ? <AvatarImage src={agentAvatarUrl} /> : null}
        <AvatarFallback className="text-xs">🤖</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{displayName}</span>
          {onStop && (
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

        {onStop && (
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

        {/* Agent Loop timeline (replaces simple turn indicator) */}
        {agentLoop && agentLoop.turns.length > 0 && (
          <div className="rounded-md border border-[#eeeeee] bg-[#fbfbfb] px-3 py-2">
            <AgentLoopTimeline loop={agentLoop} showContent="all" />
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
        {stream.content && !agentLoop && (
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
