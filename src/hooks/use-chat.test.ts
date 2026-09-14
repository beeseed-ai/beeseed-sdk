import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import { createMessagesStore } from '../stores/messages.js'
import { createConnectionStore } from '../stores/connection.js'
import type { BeeSeedContextValue } from '../provider/BeeSeedProvider.js'
import { useChat } from './use-chat.js'

const hooks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  context: null as unknown,
}))
vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
}))
vi.mock('zustand', () => ({ useStore: (store: { getState: () => unknown }) => store.getState() }))
vi.mock('../provider/BeeSeedProvider.js', () => ({ useBeeSeedContext: () => hooks.context }))

describe('chat history after connection recovery', () => {
  let cleanup: Array<() => void> = []
  beforeEach(() => { hooks.effects = [] })
  afterEach(() => { cleanup.forEach((dispose) => dispose()); cleanup = [] })

  function mount(history: () => unknown, channel = 'channel-a', sync = true) {
    const api = { get: (path: string) => path.endsWith('/messages')
      ? history()
      : { json: async () => [] } } as unknown as KyInstance
    const messagesStore = createMessagesStore({
      api, getCurrentChannelId: () => channel, getCurrentUserId: () => 'user-a', sendWsCommand: vi.fn(),
    })
    const connectionStore = createConnectionStore()
    hooks.context = {
      messagesStore, connectionStore,
      authStore: createStore(() => ({ user: { id: 'user-a' } })),
      channelsStore: createStore(() => ({ currentChannelId: channel, channels: [] })),
      ws: { send: vi.fn() },
    } as unknown as BeeSeedContextValue
    useChat(channel, { sync })
    cleanup = hooks.effects.map((effect) => effect()).filter((item): item is () => void => typeof item === 'function')
    return { messagesStore, connectionStore }
  }

  const response = () => new Response(JSON.stringify([{
    id: 123, channel_id: 'channel-a', sender_type: 'user', sender_user_id: 'user-a',
    content: 'Existing PDF and PPT history', msg_type: 'text', created_at: '2026-09-14T00:00:00Z',
  }]))

  it('loads existing history after the initial request fails and the connection recovers', async () => {
    const history = vi.fn().mockRejectedValueOnce(new Error('Worker restarting')).mockImplementation(response)
    const { messagesStore, connectionStore } = mount(history)
    await messagesStore.getState().fetchMessages('channel-a')
    expect(messagesStore.getState().getMessages('channel-a')).toEqual([])
    connectionStore.getState().setState('connected')
    await vi.waitFor(() => expect(messagesStore.getState().getMessages('channel-a')[0]?.content).toBe('Existing PDF and PPT history'))
    expect(history).toHaveBeenCalledTimes(2)
  })

  it('retries when connection recovery precedes the failing HTTP request settling', async () => {
    let reject!: (reason: Error) => void
    const history = vi.fn().mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest }))
      .mockImplementation(response)
    const { messagesStore, connectionStore } = mount(history)
    connectionStore.getState().setState('connected')
    reject(new Error('Old request failed after reconnect'))
    await vi.waitFor(() => expect(messagesStore.getState().getMessages('channel-a')[0]?.msgId).toBe(123))
    expect(history).toHaveBeenCalledTimes(2)
  })

  it('keeps loaded pages and optimistic messages on reconnect', async () => {
    const history = vi.fn().mockImplementation(response)
    const { messagesStore, connectionStore } = mount(history)
    await messagesStore.getState().fetchMessages('channel-a')
    messagesStore.getState().addOptimisticMessage('channel-a', 'Still sending')
    const loaded = messagesStore.getState().getMessages('channel-a')
    connectionStore.getState().setState('connected')
    await Promise.resolve()
    expect(history).toHaveBeenCalledTimes(1)
    expect(messagesStore.getState().getMessages('channel-a')).toBe(loaded)
  })

  it('does not loop on persistent HTTP failure or retry after leaving the channel', async () => {
    const history = vi.fn().mockRejectedValue(new Error('Unavailable'))
    const { messagesStore, connectionStore } = mount(history)
    await messagesStore.getState().fetchMessages('channel-a')
    connectionStore.getState().setState('connected')
    await vi.waitFor(() => expect(history).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 0))
    cleanup.forEach((dispose) => dispose()); cleanup = []
    connectionStore.getState().setState('disconnected')
    connectionStore.getState().setState('connected')
    await Promise.resolve()
    expect(history).toHaveBeenCalledTimes(2)
  })

  it('does not request history for sync-disabled consumers', async () => {
    const history = vi.fn().mockImplementation(response)
    const { connectionStore } = mount(history, 'channel-a', false)
    connectionStore.getState().setState('connected')
    await Promise.resolve()
    expect(history).not.toHaveBeenCalled()
  })

  it('does not refetch a successfully loaded empty channel', async () => {
    const history = vi.fn().mockImplementation(() => new Response('[]'))
    const { messagesStore, connectionStore } = mount(history)
    await messagesStore.getState().fetchMessages('channel-a')
    connectionStore.getState().setState('connected')
    connectionStore.getState().setState('disconnected')
    connectionStore.getState().setState('connected')
    await Promise.resolve()
    expect(history).toHaveBeenCalledTimes(1)
  })

  it('does not retry a pending request after the consumer unmounts', async () => {
    let reject!: (reason: Error) => void
    const history = vi.fn().mockImplementation(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest }))
    const { connectionStore } = mount(history)
    connectionStore.getState().setState('connected')
    cleanup.forEach((dispose) => dispose()); cleanup = []
    reject(new Error('Left the channel'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(history).toHaveBeenCalledTimes(1)
  })
})
