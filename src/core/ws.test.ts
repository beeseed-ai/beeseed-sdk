import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WSClient } from './ws.js'

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 3
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  readonly url: string

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(payload: string) {
    this.sent.push(payload)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

describe('WSClient reliable chat delivery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function connectedClient() {
    const events: unknown[] = []
    const client = new WSClient({
      workerUrl: 'https://worker.test',
      getToken: () => 'test-token',
      onEvent: (event) => events.push(event),
      onStateChange: vi.fn(),
    })
    client.connect()
    const socket = FakeWebSocket.instances[0]!
    socket.open()
    return { client, socket, events }
  }

  it('retries an unacknowledged message with the same client id', () => {
    const { client, socket } = connectedClient()
    client.send({ type: 'message', channel_id: 'channel-a', content: '你好' })
    const first = JSON.parse(socket.sent[0]!)
    expect(first.metadata.client_message_id).toMatch(/^[0-9a-f-]{36}$/)

    vi.advanceTimersByTime(3_000)
    const retry = JSON.parse(socket.sent[1]!)
    expect(retry.metadata.client_message_id).toBe(first.metadata.client_message_id)
    client.disconnect()
  })

  it('stops retrying after the persisted message echo acknowledges it', () => {
    const { client, socket } = connectedClient()
    client.send({ type: 'message', channel_id: 'channel-a', content: '你好' })
    const sent = JSON.parse(socket.sent[0]!)
    socket.receive({
      type: 'message',
      channel_id: 'channel-a',
      message: { id: 1, metadata: { client_message_id: sent.metadata.client_message_id } },
    })

    vi.advanceTimersByTime(9_000)
    expect(socket.sent).toHaveLength(1)
    client.disconnect()
  })

  it('keeps an idle websocket alive with application heartbeats', () => {
    const { client, socket } = connectedClient()
    vi.advanceTimersByTime(25_000)
    expect(JSON.parse(socket.sent[0]!)).toEqual({ type: 'ping' })
    client.disconnect()
  })
})
