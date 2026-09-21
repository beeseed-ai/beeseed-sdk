import type { ChannelMemberInfo } from '../../core/types.js'
import type { TypingStatus } from '../../stores/messages.js'
import { agentDisplayName } from '../../lib/members.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'
import { TypingIndicator } from './TypingIndicator.js'

interface Props {
  entry: TypingStatus
  members?: ChannelMemberInfo[]
}

/**
 * Renders an in-flight agent run with the same block shape a finished run uses:
 * avatar, name row, then a status card. Rendering the pending state as a bare
 * text line made it read as a separate component from the completed card.
 */
export function TypingBlock({ entry, members }: Props) {
  const member = members?.find((m) => m.agent_id === entry.agentId)
  const agentName = agentDisplayName(members, entry.agentId)

  return (
    <div className="flex gap-2.5 py-2.5">
      <Avatar className="mt-0.5 size-9 shrink-0">
        {member?.avatar_url ? <AvatarImage src={member.avatar_url} /> : null}
        <AvatarFallback className="text-xs">AI</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs text-[#777169]">{agentName}</span>
        </div>
        <TypingIndicator text={entry.text} />
      </div>
    </div>
  )
}
