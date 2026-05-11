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

export class WSClient {
  private ws: WebSocket | null = null
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private queue: WSCommand[] = []
  private disposed = false
  private config: WSClientConfig

  constructor(config: WSClientConfig) {
    this.config = config
  }

  connect() {
    this.disposed = false
    const token = this.config.getToken()
    if (!token) return

    this.config.onStateChange(this.attempt > 0 ? 'reconnecting' : 'connecting')

    const proto = typeof window !== 'undefined' && location.protocol === 'https:' ? 'wss:' : 'ws:'
    const base = this.config.workerUrl || `${proto}//${location.host}`
    const url = `${base.replace(/^http/, 'ws')}/ws?token=${token}`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.attempt = 0
      this.flushQueue()
    }

    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string) as WSEvent
        if (data.type === 'auth_ok') {
          this.config.onStateChange('connected')
        }
        this.config.onEvent(data)
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.ws = null
      if (!this.disposed) this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  send(command: WSCommand) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command))
    } else {
      if (this.queue.length < 50) this.queue.push(command)
    }
  }

  disconnect() {
    this.disposed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.queue = []
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
}
