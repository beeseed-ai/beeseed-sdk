import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import type { WSEvent } from '../../core/types.js'
import { createMessagesStore } from '../../stores/messages.js'
import { MessageList } from './MessageList.js'

vi.mock('./StorageAttachmentPreview.js', () => ({
  StorageAttachmentPreview: () => null,
  StoragePreviewDialog: () => null,
  useExistingStorageRefs: () => ({ existingRefs: [], isExistingRef: () => true }),
}))

const origin = Date.parse('2026-09-15T00:00:00Z')
const serverTime = (seconds: number) => new Date(origin + seconds * 1000).toISOString()

function scenario(clockOffset: number, interrupt = false) {
  vi.spyOn(Date, 'now').mockReturnValue(origin + clockOffset)
  const store = createMessagesStore({
    api: {} as KyInstance,
    getCurrentChannelId: () => 'channel-clock',
    getCurrentUserId: () => 'user-clock',
    sendWsCommand: vi.fn(),
  })
  const receive = (seconds: number, event: WSEvent) => {
    vi.mocked(Date.now).mockReturnValue(origin + seconds * 1000 + clockOffset)
    store.getState().handleEvent({ ...event, created_at: serverTime(seconds) } as WSEvent)
  }
  const identity = { channel_id: 'channel-clock', agent_id: 'assistant-clock', run_id: 'run-clock', turn: 1 }
  receive(0, { type: 'message', channel_id: identity.channel_id, message: {
    id: 1, channel_id: identity.channel_id, sender_type: 'user', sender_user_id: 'user-clock',
    content: '用户请求修改标题', msg_type: 'text', created_at: serverTime(0),
  } })
  receive(1, { ...identity, type: 'agent_progress', seq: 1, summary: 'Agent 正在思考…' })
  receive(2, { ...identity, type: 'tool_call', seq: 2, name: 'run_skill', tool_call_id: 'tool-clock' })
  receive(3, { ...identity, type: 'skill_use', seq: 3, name: 'pdf', status: 'injected' })
  if (interrupt) receive(4, { type: 'message', channel_id: identity.channel_id, message: {
    id: 2, channel_id: identity.channel_id, sender_type: 'user', sender_user_id: 'user-clock',
    content: '用户中途补充说明', msg_type: 'text', created_at: serverTime(4),
  } })
  receive(5, { ...identity, type: 'tool_result', seq: 4, name: 'run_skill', tool_call_id: 'tool-clock', success: true })
  receive(6, { ...identity, type: 'chunk', seq: 5, content: '标题已修改完成' })
  receive(7, { ...identity, type: 'agent_progress', seq: 6, summary: 'completed · idle' })
  receive(8, { ...identity, type: 'message_end', message: {
    id: 3, channel_id: identity.channel_id, sender_type: 'agent', sender_agent_id: identity.agent_id,
    content: '标题已修改完成', msg_type: 'text', created_at: serverTime(8), metadata: { run_id: identity.run_id },
  } })
  receive(8, { ...identity, type: 'agent_done', content: '标题已修改完成' })
  const state = store.getState()
  const html = renderToStaticMarkup(<MessageList channelId={identity.channel_id}
    messages={state.getMessages(identity.channel_id)} agentLoops={state.getAgentLoops(identity.channel_id)} />)
  return { html, loop: state.getAgentLoops(identity.channel_id)[0]! }
}

afterEach(() => vi.restoreAllMocks())

describe('实时聊天的服务器事件时间', () => {
  it.each([-3000, 3000])('客户端偏差 %i ms 时，运行只显示一张卡并排在触发消息之后', (offset) => {
    const { html, loop } = scenario(offset)
    expect(loop.events?.map(event => event.timestamp)).toEqual([1, 2, 3, 5, 6, 7].map(s => origin + s * 1000))
    expect(loop.startedAt).toBe(origin + 1000)
    expect(loop.completedAt).toBe(origin + 8000)
    expect(loop.turns[0].toolCalls[0]).toMatchObject({ startedAt: origin + 2000, completedAt: origin + 5000 })
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(1)
    expect(html.indexOf('用户请求修改标题')).toBeLessThan(html.indexOf('completed · idle'))
    expect(html).not.toContain('Agent 正在思考…')
    expect(html.match(/标题已修改完成/g)).toHaveLength(1)
  })

  it('真实中途插话仍然分隔运行过程', () => {
    const { html } = scenario(-3000, true)
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2)
    expect(html.indexOf('用户请求修改标题')).toBeLessThan(html.indexOf('用户中途补充说明'))
    expect(html.indexOf('用户中途补充说明')).toBeLessThan(html.lastIndexOf('completed · idle'))
    expect(html.match(/标题已修改完成/g)).toHaveLength(1)
  })

  it.each([undefined, 'invalid-date'])('旧事件时间 %s 继续使用接收时间', (created_at) => {
    vi.spyOn(Date, 'now').mockReturnValue(origin)
    const store = createMessagesStore({ api: {} as KyInstance, getCurrentChannelId: () => 'channel-clock', getCurrentUserId: () => 'user-clock', sendWsCommand: vi.fn() })
    store.getState().handleEvent({ type: 'agent_progress', channel_id: 'channel-clock', agent_id: 'assistant-clock', run_id: 'legacy', turn: 1, summary: '运行中', created_at } as WSEvent)
    expect(store.getState().getAgentLoops('channel-clock')[0].events?.[0].timestamp).toBe(origin)
  })

  it('失败终态使用服务器时间，客户端时钟跳变不放大耗时', () => {
    vi.spyOn(Date, 'now').mockReturnValue(origin - 60000)
    const store = createMessagesStore({ api: {} as KyInstance, getCurrentChannelId: () => 'channel-clock', getCurrentUserId: () => 'user-clock', sendWsCommand: vi.fn() })
    const identity = { channel_id: 'channel-clock', agent_id: 'assistant-clock', run_id: 'failed-clock', turn: 1 }
    store.getState().handleEvent({ ...identity, type: 'agent_progress', summary: '运行中', created_at: serverTime(1) })
    vi.mocked(Date.now).mockReturnValue(origin + 60000)
    store.getState().handleEvent({ ...identity, type: 'error', error: '测试失败', created_at: serverTime(3) })
    const loop = store.getState().getAgentLoops('channel-clock')[0]
    expect(loop).toMatchObject({ status: 'error', startedAt: origin + 1000, completedAt: origin + 3000 })
    expect(loop.turns[0].completedAt).toBe(origin + 3000)
  })
})
