import { describe, expect, it } from 'vitest'
import type { KyInstance } from 'ky'

import { createMessagesStore } from './messages.js'

describe('频道聊天记录清除事件', () => {
  it('只清空目标频道的消息状态', () => {
    const store = createMessagesStore({
      api: {} as KyInstance,
      getCurrentChannelId: () => 'channel-1',
      getCurrentUserId: () => 'owner',
      sendWsCommand: () => undefined,
    })
    store.getState().addOptimisticMessage('channel-1', '需要清除')
    store.getState().addOptimisticMessage('channel-2', '需要保留')
    store.setState({
      askUserAnswerOutbox: new Map([['owner:channel-1:ask-1', {
        userId: 'owner',
        channelId: 'channel-1',
        askId: 'ask-1',
        answers: { confirmed: true },
        status: 'queued',
        createdAt: Date.now(),
      }]]),
    })

    store.getState().handleEvent({
      type: 'messages_cleared',
      channel_id: 'channel-1',
      hidden_count: 1,
      hidden_through_message_id: 42,
    })

    expect(store.getState().getMessages('channel-1')).toEqual([])
    expect(store.getState().getMessages('channel-2')).toHaveLength(1)
    expect(store.getState().hasOlder('channel-1')).toBe(false)
    expect(store.getState().askUserAnswerOutbox.size).toBe(1)
  })
})
