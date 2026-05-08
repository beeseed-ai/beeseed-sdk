import type { StreamState } from '../../core/types.js'
import { Avatar, AvatarFallback } from '../ui/avatar.js'

interface Props {
  stream: StreamState
}

export function StreamRenderer({ stream }: Props) {
  return (
    <div className="flex gap-2 px-4 py-1">
      <Avatar className="size-7 shrink-0 mt-0.5">
        <AvatarFallback className="text-xs">🤖</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-0.5 max-w-[75%]">
        <span className="text-xs text-muted-foreground">{stream.agentId}</span>

        {stream.thinking && (
          <div className="rounded-lg px-3 py-2 text-sm bg-accent/50 text-accent-foreground italic whitespace-pre-wrap break-words">
            {stream.thinking}
          </div>
        )}

        {stream.toolCall && (
          <div className="rounded-lg px-3 py-1.5 text-xs bg-muted border border-border text-muted-foreground">
            ⚙️ {stream.toolCall.name}
          </div>
        )}

        {stream.content && (
          <div className="rounded-lg px-3 py-2 text-sm bg-muted text-foreground whitespace-pre-wrap break-words">
            {stream.content}
            <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
          </div>
        )}
      </div>
    </div>
  )
}
