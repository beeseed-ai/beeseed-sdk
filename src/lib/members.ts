import type { ChannelMemberInfo } from '../core/types.js'

/**
 * Resolves the name shown to users for an agent in a channel. Agent events only
 * carry the raw agent id, so every user-facing label has to resolve it against
 * the channel member list. Falls back to the id when members have not loaded or
 * hold no entry — showing the id is better than showing nothing.
 */
export function agentDisplayName(members: ChannelMemberInfo[] | undefined, agentId: string | undefined): string {
  const member = agentId ? members?.find((m) => m.agent_id === agentId) : undefined
  return member?.display_name || agentId || 'Agent'
}
