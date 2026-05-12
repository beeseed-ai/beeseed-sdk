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
    }

    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string) as WSEvent
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
      if (!this.disposed) this.scheduleReconnect()
    }

    this.ws.onerror = (evt) => {
      console.error('[WS] error', evt)
      this.ws?.close()
    }
  }

  send(command: WSCommand) {
    const cmd = command as Record<string, unknown>
    const cmdType = cmd.type as string
    const cmdRoom = (cmd.room_id as string) || ''
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command))
    } else {
      if (cmdType === 'join_room' || cmdType === 'leave_room') {
        this.queue = this.queue.filter(q => {
          const qt = (q as Record<string, unknown>).type
          const qr = (q as Record<string, unknown>).room_id
          return !(qt === 'join_room' || qt === 'leave_room') || qr !== cmdRoom
        })
      }
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
