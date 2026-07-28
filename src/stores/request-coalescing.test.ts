import { describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'

import type { Message } from '../core/types.js'
import { createMessagesStore } from './messages.js'
import { createTasksStore } from './tasks.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function messagesConfig(api: KyInstance) {
  return {
    api,
    getCurrentChannelId: () => 'channel-1',
    getCurrentUserId: () => 'user-1',
    sendWsCommand: () => undefined,
  }
}

describe('SDK Store 请求合并', () => {
  it('同一频道并发加载消息只发送一次请求', async () => {
    const result = deferred<Message[]>()
    const get = vi.fn(() => ({
      headers: new Headers(),
      json: () => result.promise,
    }))
    const store = createMessagesStore(messagesConfig({ get } as unknown as KyInstance))

    const first = store.getState().fetchMessages('channel-1')
    const second = store.getState().fetchMessages('channel-1')

    expect(first).toBe(second)
    expect(get).toHaveBeenCalledTimes(1)
    result.resolve([])
    await first
    expect(store.getState().loadingChannel).toBeNull()
  })

  it('同一频道并发加载任务只发送一次请求', async () => {
    const result = deferred<{ tasks: [] }>()
    const get = vi.fn(() => ({ json: () => result.promise }))
    const store = createTasksStore({ api: { get } as unknown as KyInstance })

    const first = store.getState().fetchTasks('channel-1')
    const second = store.getState().fetchTasks('channel-1')

    expect(first).toBe(second)
    expect(get).toHaveBeenCalledTimes(1)
    result.resolve({ tasks: [] })
    await first
    expect(store.getState().loading).toBe(false)
  })

  it('Agent Run 详情按 run_id 加载并记住已完成状态', async () => {
    const messages: Message[] = [{
      id: 10,
      channel_id: 'channel-1',
      sender_type: 'agent',
      sender_agent_id: 'agent-1',
      content: '已完成',
      msg_type: 'thinking',
      metadata: { source: 'agent_loop', event: 'agent_done', run_id: 'run-1', turn: 1 },
      created_at: '2026-07-28T12:00:00.000Z',
    }]
    const get = vi.fn(() => ({ json: async () => messages }))
    const store = createMessagesStore(messagesConfig({ get } as unknown as KyInstance))

    await store.getState().loadAgentRunDetails('channel-1', 'agent-1', 'run-1')
    await store.getState().loadAgentRunDetails('channel-1', 'agent-1', 'run-1')

    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('channels/channel-1/messages', { searchParams: { run_id: 'run-1' } })
    expect(store.getState().agentLoops.get('channel-1:agent-1:run-1')?.status).toBe('completed')
    expect(store.getState().loadedAgentRunDetails.has('channel-1:agent-1:run-1')).toBe(true)
  })
})
