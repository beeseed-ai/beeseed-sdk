import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { KyInstance } from 'ky'
import type { AppRuntimeConfig, BeeSeedConfig, WSEvent } from '../core/types.js'
import { createApiClient } from '../core/client.js'
import { WSClient } from '../core/ws.js'
import { createAuthStore, type AuthStore } from '../stores/auth.js'
import { createConnectionStore, type ConnectionStore } from '../stores/connection.js'
import { createChannelsStore, type ChannelsStore } from '../stores/channels.js'
import { createMessagesStore, type MessagesStore } from '../stores/messages.js'
import { createDetailPanelStore, type DetailPanelStore } from '../stores/detail-panel.js'
import { createTasksStore, type TasksStore } from '../stores/tasks.js'
import { createKnowledgeStore, type KnowledgeStore } from '../stores/knowledge.js'
import { createStorageStore, type StorageStore } from '../stores/storage.js'
import { createNotificationsStore, type NotificationsStore } from '../stores/notifications.js'
import { createCronStore, type CronStore } from '../stores/cron.js'
import { createAgentsStore, type AgentsStore } from '../stores/agents.js'
import { createAppUsersStore, type AppUsersStore } from '../stores/app-users.js'
import { createInvitesStore, type InvitesStore } from '../stores/invites.js'
import { createAppSettingsStore, type AppSettingsStore } from '../stores/app-settings.js'

export interface BeeSeedContextValue {
  api: KyInstance
  ws: WSClient
  authStore: AuthStore
  connectionStore: ConnectionStore
  channelsStore: ChannelsStore
  messagesStore: MessagesStore
  detailPanelStore: DetailPanelStore
  tasksStore: TasksStore
  knowledgeStore: KnowledgeStore
  storageStore: StorageStore
  notificationsStore: NotificationsStore
  cronStore: CronStore
  agentsStore: AgentsStore
  appUsersStore: AppUsersStore
  invitesStore: InvitesStore
  appSettingsStore: AppSettingsStore
  config: BeeSeedConfig
  updateAppConfig: (appConfig: AppRuntimeConfig) => void
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

function createBeeSeedContext(config: BeeSeedConfig, updateAppConfig: (appConfig: AppRuntimeConfig) => void): BeeSeedContextValue {
  const tokenKey = config.tokenKey ?? 'beeseed_token'
  const useMock = config.useMockData ?? false
  const getToken = () => {
    try { return localStorage.getItem(tokenKey) } catch { return null }
  }

  const connectionStore = createConnectionStore()
  const api = createApiClient({ workerUrl: config.workerUrl, getToken })
  const channelsStore = createChannelsStore({ api })

  let wsSendRef: (cmd: unknown) => void = () => {}

  const messagesStore = createMessagesStore({
    api,
    getCurrentChannelId: () => channelsStore.getState().currentChannelId,
    getCurrentUserId: () => authStore.getState().user?.id,
    sendWsCommand: (cmd) => wsSendRef(cmd),
  })

  const detailPanelStore = createDetailPanelStore()
  const tasksStore = createTasksStore({ api, useMock })
  const knowledgeStore = createKnowledgeStore({ api, useMock })
  const storageStore = createStorageStore({ api, useMock })
  const notificationsStore = createNotificationsStore({ api, useMock })
  const cronStore = createCronStore({ api, useMock })
  const agentsStore = createAgentsStore({ api, useMock })
  const appUsersStore = createAppUsersStore({ api, useMock })
  const invitesStore = createInvitesStore({ api, useMock })
  const appSettingsStore = createAppSettingsStore({ api, useMock })

  let wsRef: WSClient

  const authStore = createAuthStore({
    api,
    tokenKey,
    onSignIn: () => {
      console.log('[Auth] onSignIn, wsRef exists:', !!wsRef)
      wsRef?.connect()
      void channelsStore.getState().fetchChannels()
    },
    onSignOut: () => {
      wsRef?.disconnect()
      channelsStore.getState().reset()
      messagesStore.getState().reset()
      detailPanelStore.getState().reset()
      tasksStore.getState().reset()
      knowledgeStore.getState().reset()
      storageStore.getState().reset()
      notificationsStore.getState().reset()
      cronStore.getState().reset()
      agentsStore.getState().reset()
      config.onAuthError?.()
    },
  })

  const handleEvent = (event: WSEvent) => {
    console.log('[Provider] handleEvent', event.type)
    if (event.type === 'auth_ok') {
      channelsStore.getState().setChannels(event.channels ?? [])
    }
    messagesStore.getState().handleEvent(event)

    if (event.type === 'message' || event.type === 'message_end') {
      void channelsStore.getState().fetchChannels()
    }
    if (event.type === 'task_updated') {
      void tasksStore.getState().fetchTasks(event.channel_id)
      void tasksStore.getState().fetchMetrics(event.channel_id)
    }
  }

  const ws = new WSClient({
    workerUrl: config.workerUrl,
    getToken,
    onEvent: handleEvent,
    onStateChange: (state) => connectionStore.getState().setState(state),
  })
  wsRef = ws
  wsSendRef = (cmd) => ws.send(cmd as Parameters<typeof ws.send>[0])

  return {
    api, ws, authStore, connectionStore, channelsStore, messagesStore,
    detailPanelStore, tasksStore, knowledgeStore, storageStore,
    notificationsStore, cronStore, agentsStore, appUsersStore, invitesStore, appSettingsStore, config, updateAppConfig,
  }
}

export function BeeSeedProvider({ config, children }: Props) {
  const updateRef = useRef<(appConfig: AppRuntimeConfig) => void>(() => {})
  const [ctx, setCtx] = useState<BeeSeedContextValue>(() => createBeeSeedContext(config, (appConfig) => updateRef.current(appConfig)))
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx
  updateRef.current = (appConfig) => {
    setCtx((current) => ({
      ...current,
      config: { ...current.config, appConfig },
    }))
  }

  useEffect(() => {
    const current = ctxRef.current
    void current.authStore.getState().init()
    return () => current.ws.disconnect()
  }, [])

  return (
    <BeeSeedContext.Provider value={ctx}>
      {children}
    </BeeSeedContext.Provider>
  )
}
