import { describe, expect, it } from 'vitest'
import type { ChannelMemberInfo } from '../../core/types.js'
import { getFilteredCount, getFilteredMember } from './MentionMenu.js'

const member = (input: Partial<ChannelMemberInfo> & Pick<ChannelMemberInfo, 'id' | 'member_type' | 'display_name'>): ChannelMemberInfo => ({
  channel_id: 'channel-1',
  role: 'member',
  is_coordinator: false,
  joined_at: '2026-10-04T00:00:00Z',
  ...input,
})

const members = [
  member({ id: 'membership-self', member_type: 'user', user_id: 'user-self', display_name: '我自己' }),
  member({ id: 'membership-other', member_type: 'user', user_id: 'user-other', display_name: '其他用户' }),
  member({ id: 'membership-agent', member_type: 'agent', agent_id: 'agent-writer', display_name: '写作助手' }),
]

describe('mention candidates', () => {
  it('excludes the current user while keeping other users and agents selectable', () => {
    expect(getFilteredCount(members, '', 'user-self')).toBe(2)
    expect(getFilteredMember(members, '', 0, 'user-self')?.user_id).toBe('user-other')
    expect(getFilteredMember(members, '', 1, 'user-self')?.agent_id).toBe('agent-writer')
  })

  it('still applies the text query after excluding the current user', () => {
    expect(getFilteredCount(members, '自己', 'user-self')).toBe(0)
    expect(getFilteredMember(members, '写作', 0, 'user-self')?.agent_id).toBe('agent-writer')
  })
})
