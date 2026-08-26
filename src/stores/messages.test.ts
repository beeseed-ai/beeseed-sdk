import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import type { ChatMessage, Message } from '../core/types.js'
import { createMessagesStore, parseMessage } from './messages.js'

describe('ask_user agent session binding', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value) },
        removeItem: (key: string) => { storage.delete(key) },
        clear: () => storage.clear(),
      },
    })
  })

  function askMessage(status: 'pending' | 'queued' | 'answered' | 'expired' | 'failed' = 'pending'): ChatMessage {
    return {
      role: 'tool',
      content: '',
      timestamp: Date.now(),
      askUserData: {
        askId: 'ask-a',
        agentSessionId: 'session-a',
        status,
        questions: [{ id: 'q1', type: 'single_select', title: 'Choose' }],
      },
    }
  }

  function wireAsk(status: 'pending' | 'answered' | 'expired' = 'pending'): Message {
    return {
      id: 72,
      channel_id: 'channel-a',
      agent_session_id: 'session-a',
      sender_type: 'agent',
      sender_agent_id: 'agent-a',
      content: '',
      msg_type: 'tool_call',
      metadata: {
        name: 'ask_user',
        _ask_id: 'ask-a',
        ask_user_status: status,
        questions: [{ id: 'q1', type: 'single_select', title: 'Choose' }],
      },
      created_at: '2026-08-23T00:00:00Z',
    }
  }

  function apiReturning(messages: Message[]) {
    return {
      get: vi.fn().mockResolvedValue(new Response(JSON.stringify(messages))),
    } as unknown as KyInstance
  }

  it('preserves agent_session_id while parsing an ask_user message', () => {
    const wire: Message = {
      id: 72,
      channel_id: 'channel-a',
      agent_session_id: 'session-a',
      sender_type: 'agent',
      sender_agent_id: 'agent-a',
      content: '',
      msg_type: 'tool_call',
      metadata: {
        name: 'ask_user',
        _ask_id: 'ask-a',
        questions: [{ id: 'q1', type: 'single_select', title: 'Choose' }],
      },
      created_at: '2026-08-23T00:00:00Z',
    }

    expect(parseMessage(wire)?.askUserData?.agentSessionId).toBe('session-a')
  })

  it('sends the bound agent_session_id when answering', () => {
    const sendWsCommand = vi.fn()
    const store = createMessagesStore({
      api: {} as KyInstance,
      getCurrentChannelId: () => 'channel-a',
      getCurrentUserId: () => 'user-a',
      sendWsCommand,
    })
    store.setState({ messages: new Map([['channel-a', [askMessage()]]]) })

    store.getState().submitAskUserAnswer('channel-a', 'ask-a', { q1: 'blue' })

    expect(sendWsCommand).toHaveBeenCalledWith({
      type: 'ask_user_answer',
      channel_id: 'channel-a',
      agent_session_id: 'session-a',
      ask_id: 'ask-a',
      answers: { q1: 'blue' },
    })
    expect(store.getState().getMessages('channel-a')[0].askUserData).toMatchObject({
      status: 'queued',
      answers: { q1: 'blue' },
    })
    expect(storage.size).toBe(1)
  })

  it('restores a queued answer after refresh and retries after authentication', async () => {
    const firstSend = vi.fn()
    const first = createMessagesStore({
      api: apiReturning([]),
      getCurrentChannelId: () => 'channel-a',
      getCurrentUserId: () => 'user-a',
      sendWsCommand: firstSend,
    })
    first.setState({ messages: new Map([['channel-a', [askMessage()]]]) })
    first.getState().submitAskUserAnswer('channel-a', 'ask-a', { q1: 'blue' })

    const retrySend = vi.fn()
    const restored = createMessagesStore({
      api: apiReturning([wireAsk()]),
      getCurrentChannelId: () => 'channel-a',
      getCurrentUserId: () => 'user-a',
      sendWsCommand: retrySend,
    })
    await restored.getState().fetchMessages('channel-a')

    expect(restored.getState().getMessages('channel-a')[0].askUserData).toMatchObject({
      status: 'queued',
      answers: { q1: 'blue' },
    })
    restored.getState().flushPendingAskUserAnswers()
    expect(retrySend).toHaveBeenCalledTimes(1)
  })

  it('marks an answer as answered only after the server ACK', () => {
    const store = createMessagesStore({
      api: apiReturning([]),
      getCurrentChannelId: () => 'channel-a',
      getCurrentUserId: () => 'user-a',
      sendWsCommand: vi.fn(),
    })
    store.setState({ messages: new Map([['channel-a', [askMessage()]]]) })
    store.getState().submitAskUserAnswer('channel-a', 'ask-a', { q1: 'blue' })
    store.getState().handleEvent({
      type: 'ask_user_answer_ack',
      channel_id: 'channel-a',
      agent_session_id: 'session-a',
      ask_id: 'ask-a',
      answers: { q1: 'blue' },
    })

    expect(store.getState().getMessages('channel-a')[0].askUserData?.status).toBe('answered')
    expect(store.getState().askUserAnswerOutbox.size).toBe(0)
    expect(storage.size).toBe(0)
  })

  it('keeps a permanent rejection locked and visible after refresh', async () => {
    const store = createMessagesStore({
      api: apiReturning([]),
      getCurrentChannelId: () => 'channel-a',
      getCurrentUserId: () => 'user-a',
      sendWsCommand: vi.fn(),
    })
    store.setState({ messages: new Map([['channel-a', [askMessage()]]]) })
    store.getState().submitAskUserAnswer('channel-a', 'ask-a', { q1: 'blue' })
    store.getState().handleEvent({
      type: 'ask_user_answer_rejected',
      channel_id: 'channel-a',
      agent_session_id: 'session-a',
      ask_id: 'ask-a',
      error_code: 'expired',
      error: '该提问已过期，答案未被接受。',
      retryable: false,
    })
    expect(store.getState().getMessages('channel-a')[0].askUserData?.status).toBe('failed')

    const restored = createMessagesStore({
      api: apiReturning([wireAsk('expired')]),
      getCurrentChannelId: () => 'channel-a',
      getCurrentUserId: () => 'user-a',
      sendWsCommand: vi.fn(),
    })
    await restored.getState().fetchMessages('channel-a')
    expect(restored.getState().getMessages('channel-a')[0].askUserData).toMatchObject({
      status: 'failed',
      answers: { q1: 'blue' },
    })
  })
})

describe('ReasonIX run typing status', () => {
  function createStore() {
    return createMessagesStore({
      api: {} as KyInstance,
      getCurrentChannelId: () => 'channel-a',
      getCurrentUserId: () => 'user-a',
      sendWsCommand: vi.fn(),
    })
  }

  it.each(['queued', 'starting', 'running', 'waiting_tool'])('shows thinking for %s', (status) => {
    const store = createStore()

    store.getState().handleEvent({
      type: 'agent_run_status',
      channel_id: 'channel-a',
      agent_id: 'agent-a',
      run_id: 'run-a',
      status,
    })

    expect(store.getState().getTyping('channel-a')).toBe('agent-a 正在思考...')
  })

  it.each(['completed', 'failed', 'canceled', 'timed_out', 'fenced', 'budget_exhausted', 'loop_blocked'])('clears thinking for %s', (status) => {
    const store = createStore()
    store.setState({ typingStatus: new Map([['channel-a:agent-a', 'agent-a 正在思考...']]) })

    store.getState().handleEvent({
      type: 'agent_run_status',
      channel_id: 'channel-a',
      agent_id: 'agent-a',
      run_id: 'run-a',
      status,
    })

    expect(store.getState().getTyping('channel-a')).toBe('')
  })
})
