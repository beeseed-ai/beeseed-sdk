import { describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'

import type { ChannelWithMeta } from '../core/types.js'
import { createChannelsStore } from './channels.js'

function channel(id: string): ChannelWithMeta {
  return {
    id,
    name: id,
    created_by: 'owner',
    created_at: '2026-07-31T00:00:00.000Z',
    updated_at: '2026-07-31T00:00:00.000Z',
    member_count: 1,
    unread_count: 0,
  }
}

describe('频道成员退出', () => {
  it('删除自己的频道成员关系并切换当前频道', async () => {
    const del = vi.fn(async () => undefined)
    const store = createChannelsStore({ api: { delete: del } as unknown as KyInstance })
    store.getState().setChannels([channel('joined-channel'), channel('remaining-channel')])
    store.getState().setCurrentChannel('joined-channel')

    const result = await store.getState().leaveChannelMembership('joined-channel')

    expect(result).toEqual({ error: null })
    expect(del).toHaveBeenCalledWith('channels/joined-channel/membership')
    expect(store.getState().channels.map((item) => item.id)).toEqual(['remaining-channel'])
    expect(store.getState().currentChannelId).toBe('remaining-channel')
  })
})
