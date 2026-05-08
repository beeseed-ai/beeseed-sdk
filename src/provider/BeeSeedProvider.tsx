import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import type { KyInstance } from 'ky'
import type { BeeSeedConfig, WSEvent } from '../core/types.js'
import { createApiClient } from '../core/client.js'
import { WSClient } from '../core/ws.js'
import { createAuthStore, type AuthStore } from '../stores/auth.js'
import { createConnectionStore, type ConnectionStore } from '../stores/connection.js'
import { createRoomsStore, type RoomsStore } from '../stores/rooms.js'
import { createMessagesStore, type MessagesStore } from '../stores/messages.js'

export interface BeeSeedContextValue {
  api: KyInstance
  ws: WSClient
  authStore: AuthStore
  connectionStore: ConnectionStore
  roomsStore: RoomsStore
  messagesStore: MessagesStore
  config: BeeSeedConfig
}

const BeeSeedContext = createContext<BeeSeedContextValue | null>(null)

export function useBeeSeedContext() {
  const ctx = useContext(BeeSeedContext)
  if (!ctx) throw new Error('useBeeSeedContext must be used within <BeeSeedProvider>')
  return ctx
}

interface Props {
  config: BeeSeedConfig
  children: ReactNode
}

function createBeeSeedContext(config: BeeSeedConfig): BeeSeedContextValue {
  const tokenKey = config.tokenKey ?? 'beeseed_token'
  const getToken = () => {
    try { return localStorage.getItem(tokenKey) } catch { return null }
  }

  const connectionStore = createConnectionStore()

  const api = createApiClient({ workerUrl: config.workerUrl, getToken })

  const roomsStore = createRoomsStore({ api })
  const messagesStore = createMessagesStore({
    api,
    getCurrentRoomId: () => roomsStore.getState().currentRoomId,
  })

  // Will be set after ws is created
  let wsRef: WSClient

  const authStore = createAuthStore({
    api,
    tokenKey,
    onSignIn: () => {
      wsRef?.connect()
      void roomsStore.getState().fetchRooms()
    },
    onSignOut: () => {
      wsRef?.disconnect()
      roomsStore.getState().reset()
      messagesStore.getState().reset()
      config.onAuthError?.()
    },
  })

  const handleEvent = (event: WSEvent) => {
    if (event.type === 'auth_ok') {
      roomsStore.getState().setRooms(event.rooms ?? [])
    }
    messagesStore.getState().handleEvent(event)

    if (event.type === 'message' || event.type === 'message_end') {
      void roomsStore.getState().fetchRooms()
    }
  }

  const ws = new WSClient({
    workerUrl: config.workerUrl,
    getToken,
    onEvent: handleEvent,
    onStateChange: (state) => connectionStore.getState().setState(state),
  })
  wsRef = ws

  return { api, ws, authStore, connectionStore, roomsStore, messagesStore, config }
}

export function BeeSeedProvider({ config, children }: Props) {
  const ref = useRef<BeeSeedContextValue | null>(null)
  if (!ref.current) {
    ref.current = createBeeSeedContext(config)
  }

  useEffect(() => {
    const ctx = ref.current!
    void ctx.authStore.getState().init()
    return () => ctx.ws.disconnect()
  }, [])

  return (
    <BeeSeedContext.Provider value={ref.current}>
      {children}
    </BeeSeedContext.Provider>
  )
}
