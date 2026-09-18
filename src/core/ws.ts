import type { WSEvent, WSCommand } from './types.js'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface WSClientConfig {
  workerUrl: string
  getToken: () => string | null
  onEvent: (event: WSEvent) => void
  onStateChange: (state: ConnectionState) => void
}

const MAX_BACKOFF = 30_000
const STREAM_TIMEOUT = 60_000
const HEARTBEAT_INTERVAL = 25_000
const MESSAGE_RETRY_INTERVAL = 3_000

export class WSClient {
  private ws: WebSocket | null = null
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private queue: WSCommand[] = []
  private pendingMessages = new Map<string, WSCommand>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private messageRetryTimer: ReturnType<typeof setInterval> | null = null
  private disposed = false
  private config: WSClientConfig

  constructor(config: WSClientConfig) {
    this.config = config
  }

  connect() {
    this.disposed = false
    const token = this.config.getToken()
    if (!token) return

    if (this.ws) {
      const rs = this.ws.readyState
      if (rs === WebSocket.CONNECTING || rs === WebSocket.OPEN) {
        return
      }
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }

    this.config.onStateChange(this.attempt > 0 ? 'reconnecting' : 'connecting')

    const proto = typeof window !== 'undefined' && location.protocol === 'https:' ? 'wss:' : 'ws:'
    const base = this.config.workerUrl || `${proto}//${location.host}`
    const url = `${base.replace(/^http/, 'ws')}/ws?token=${token}`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('[WS] connected', url.replace(/token=.*/, 'token=***'))
      this.attempt = 0
      this.flushQueue()
      this.flushPendingMessages()
      this.startConnectionTimers()
    }

    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string) as WSEvent
        this.acknowledgeMessage(data)
        if (data.type === 'auth_ok') {
          this.config.onStateChange('connected')
        }
        this.config.onEvent(data)
      } catch (e) {
        console.warn('[WS] parse error', e)
      }
    }

    this.ws.onclose = (evt) => {
      console.log('[WS] closed', evt.code, evt.reason)
      this.ws = null
      this.stopConnectionTimers()
      if (!this.disposed) this.scheduleReconnect()
    }

    this.ws.onerror = (evt) => {
      console.error('[WS] error', evt)
      this.ws?.close()
    }
  }

  send(command: WSCommand): boolean {
    const cmd = command as Record<string, unknown>
    const cmdType = cmd.type as string
    const cmdChannel = (cmd.channel_id as string) || ''
    if (cmdType === 'message') {
      const reliable = this.prepareReliableMessage(command)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(reliable))
        return true
      }
      return false
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command))
      return true
    } else {
      // Ask User answers have their own persistent outbox. Keeping a second
      // in-memory copy here would send the same answer twice after reconnect.
      if (cmdType === 'ask_user_answer') return false
      if (cmdType === 'join_channel' || cmdType === 'leave_channel') {
        this.queue = this.queue.filter(q => {
          const qt = (q as Record<string, unknown>).type
          const qr = (q as Record<string, unknown>).channel_id as string
          return !(qt === 'join_channel' || qt === 'leave_channel') || qr !== cmdChannel
        })
      }
      if (this.queue.length < 50) this.queue.push(command)
      return false
    }
  }

  disconnect() {
    this.disposed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.queue = []
    this.pendingMessages.clear()
    this.stopConnectionTimers()
    this.config.onStateChange('disconnected')
  }

  get streamTimeout() {
    return STREAM_TIMEOUT
  }

  private scheduleReconnect() {
    this.config.onStateChange('reconnecting')
    const delay = Math.min(1000 * Math.pow(2, this.attempt), MAX_BACKOFF) + Math.random() * 500
    this.attempt++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private flushQueue() {
    while (this.queue.length > 0) {
      const cmd = this.queue.shift()!
      this.send(cmd)
    }
  }

  private prepareReliableMessage(command: WSCommand): WSCommand {
    const raw = command as Extract<WSCommand, { type: 'message' }>
    const existing = typeof raw.metadata?.client_message_id === 'string'
      ? raw.metadata.client_message_id.trim()
      : ''
    const clientMessageId = existing || createClientMessageID()
    const reliable: WSCommand = {
      ...raw,
      metadata: { ...raw.metadata, client_message_id: clientMessageId },
    }
    this.pendingMessages.set(clientMessageId, reliable)
    return reliable
  }

  private acknowledgeMessage(event: WSEvent) {
    if (event.type !== 'message' || !event.message) return
    const metadata = event.message.metadata
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return
    const clientMessageId = (metadata as Record<string, unknown>).client_message_id
    if (typeof clientMessageId === 'string') this.pendingMessages.delete(clientMessageId)
  }

  private flushPendingMessages() {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    for (const command of this.pendingMessages.values()) {
      this.ws.send(JSON.stringify(command))
    }
  }

  private startConnectionTimers() {
    this.stopConnectionTimers()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'ping' }))
    }, HEARTBEAT_INTERVAL)
    this.messageRetryTimer = setInterval(() => this.flushPendingMessages(), MESSAGE_RETRY_INTERVAL)
  }

  private stopConnectionTimers() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.messageRetryTimer) clearInterval(this.messageRetryTimer)
    this.heartbeatTimer = null
    this.messageRetryTimer = null
  }
}

function createClientMessageID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16)
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16)
  })
}
