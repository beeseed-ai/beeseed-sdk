// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import type { Message } from '../core/types.js'
import { createMessagesStore } from './messages.js'

afterEach(() => vi.restoreAllMocks())

describe('Agent 正式产物交付刷新云存储', () => {
  const artifact = {
    artifact_id: 'artifact-a', object_id: 'object-a',
    storage_ref: 'storage://channels/channel-a/result.pptx', file_name: 'result.pptx',
  }

  it.each([
    ['正式交付', 'agent', { artifacts: [artifact] }, 1],
    ['仅工作区文件', 'agent', { artifacts: [{ ...artifact, storage_ref: 'storage://workspace/result.pptx' }] }, 0],
    ['尚无存储对象', 'agent', { artifacts: [{ ...artifact, object_id: undefined }] }, 0],
    ['普通文本', 'agent', {}, 0],
    ['用户消息中的引用', 'user', { artifacts: [artifact] }, 0],
  ] as const)('%s', (_name, senderType, metadata, count) => {
    const dispatch = vi.spyOn(window, 'dispatchEvent')
    const store = createMessagesStore({
      api: {} as KyInstance, getCurrentChannelId: () => 'channel-a',
      getCurrentUserId: () => 'user-a', sendWsCommand: vi.fn(),
    })
    const message: Message = {
      id: 1, channel_id: 'channel-a', sender_type: senderType,
      sender_agent_id: senderType === 'agent' ? 'agent-a' : undefined,
      sender_user_id: senderType === 'user' ? 'user-a' : undefined,
      content: '生成完成', msg_type: 'text', metadata,
      created_at: '2026-09-15T12:00:00Z',
    }
    store.getState().handleEvent({ type: 'message', channel_id: 'channel-a', message })
    const events = dispatch.mock.calls.map(([event]) => event).filter(event => event.type === 'beeseed:storage-mutated')
    expect(events).toHaveLength(count)
    if (count) expect((events[0] as CustomEvent).detail.channelId).toBe('channel-a')
    expect(store.getState().messages.get('channel-a')).toHaveLength(1)
  })
})
