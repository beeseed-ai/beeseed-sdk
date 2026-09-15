import { describe, expect, it } from 'vitest'
import type { KyInstance } from 'ky'
import { createMessagesStore } from './messages.js'

describe('频道请求失败反馈', () => {
  it('无Agent的失败显示在事件频道，不泄漏内部错误或篡改用户消息，连续失败合并', () => {
    const store = createMessagesStore({ api: {} as KyInstance, getCurrentChannelId: () => 'b', getCurrentUserId: () => 'user', sendWsCommand: () => true })
    store.getState().addOptimisticMessage('a', '生成一份文件')
    store.getState().addOptimisticMessage('b', '另一频道的消息')
    const a = store.getState().getMessages('a')[0]
    const b = store.getState().getMessages('b')
    const failure = { type: 'error' as const, channel_id: 'a', error: 'db: ensure ReasonIX Run contract: No space left on device' }
    store.getState().handleEvent(failure)
    store.getState().handleEvent(failure)
    expect(store.getState().getMessages('a')).toEqual([a, expect.objectContaining({ role: 'system', systemSource: 'request_error', content: '本次请求未能完成，请稍后重试。' })])
    expect(JSON.stringify(store.getState().getMessages('a'))).not.toContain('No space')
    expect(store.getState().getMessages('b')).toBe(b)
    expect(store.getState().agentLoops.size).toBe(0)
    store.getState().addOptimisticMessage('a', '再次尝试')
    store.getState().handleEvent(failure)
    expect(store.getState().getMessages('a').filter(x => x.systemSource === 'request_error')).toHaveLength(2)
  })

  it('全局错误不猜测当前频道，Agent错误不追加通用请求提示', () => {
    const store = createMessagesStore({ api: {} as KyInstance, getCurrentChannelId: () => 'a', getCurrentUserId: () => 'user', sendWsCommand: () => true })
    store.getState().handleEvent({ type: 'error', error: 'connection error' })
    store.getState().handleEvent({ type: 'error', channel_id: 'a', agent_id: 'assistant', run_id: 'run-a', error: 'agent failure' })
    expect(store.getState().getMessages('a')).toEqual([])
  })
})
