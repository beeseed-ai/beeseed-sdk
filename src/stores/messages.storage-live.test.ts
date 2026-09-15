// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import { createMessagesStore } from './messages.js'

const makeStore = () => createMessagesStore({
  api: {} as KyInstance, getCurrentChannelId: () => 'channel-a',
  getCurrentUserId: () => 'user-a', sendWsCommand: vi.fn(),
})
const run = { channel_id: 'channel-a', agent_id: 'agent-a', run_id: 'run-a' }
afterEach(() => vi.restoreAllMocks())

describe('ReasonIX 实时等待和存储反馈', () => {
  it('等待状态不被迟到进度和工具结果覆盖，回答后的运行事件恢复原 Run', () => {
    const store = makeStore(), send = store.getState().handleEvent
    send({ type: 'agent_ack', ...run, turn: 1 })
    send({ type: 'agent_run_status', ...run, status: 'waiting_user' })
    send({ type: 'agent_progress', ...run, summary: 'completed · idle', turn: 1 })
    send({ type: 'tool_result', ...run, name: 'mcp__channel__ask_user', success: true, output: 'waiting', turn: 1 })
    expect(store.getState().getAgentLoops('channel-a')[0].status).toBe('waiting_for_user')
    expect(store.getState().streams.size).toBe(0)
    send({ type: 'agent_run_status', ...run, status: 'running' })
    expect(store.getState().getAgentLoops('channel-a')[0].status).toBe('running')
    send({ type: 'agent_run_status', ...run, status: 'completed' })
    send({ type: 'agent_run_status', ...run, status: 'waiting_user' })
    expect(store.getState().getAgentLoops('channel-a')[0].status).toBe('completed')
  })

  it('显式新轮次可以恢复旧协议的等待状态', () => {
    const store = makeStore(), send = store.getState().handleEvent
    send({ type: 'agent_waiting_user', ...run, turn: 1, summary: '等待回答' })
    send({ type: 'agent_progress', ...run, turn: 1, summary: 'completed · idle' })
    expect(store.getState().getAgentLoops('channel-a')[0].status).toBe('waiting_for_user')
    send({ type: 'agent_turn_start', ...run, turn: 2 })
    expect(store.getState().getAgentLoops('channel-a')[0].status).toBe('running')
  })

  it.each([
    ['storage_write', true, 1], ['storage_delete', true, 1],
    ['mcp__BeeSeed_Channel_abc__storage_write', true, 1],
    ['mcp__BeeSeed_Channel_abc__storage_delete', true, 1],
    ['mcp__BeeSeed_Channel_abc__storage_delete', false, 0],
    ['mcp__BeeSeed_Channel_abc__storage_read', true, 0],
    ['other__storage_delete', true, 0],
  ])('工具 %s 成功=%s 只发送对应频道的变更通知', (name, success, count) => {
    const dispatch = vi.spyOn(window, 'dispatchEvent')
    makeStore().getState().handleEvent({ type: 'tool_result', ...run, name, success, output: 'result', turn: 1 })
    const events = dispatch.mock.calls.map(([event]) => event).filter(event => event.type === 'beeseed:storage-mutated')
    expect(events).toHaveLength(count)
    if (count) expect((events[0] as CustomEvent).detail.channelId).toBe('channel-a')
  })
})
