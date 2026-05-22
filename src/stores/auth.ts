import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { User, AuthResponse } from '../core/types.js'

const DEFAULT_TOKEN_KEY = 'beeseed_token'

export interface AuthState {
  user: User | null
  token: string | null
  loading: boolean

  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  sendSMSCode: (phone: string, purpose: 'login' | 'register', options?: { inviteCode?: string }) => Promise<{ error: string | null; purpose?: 'login' | 'register' }>
  signInWithSMS: (phone: string, code: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string, inviteCode?: string) => Promise<{ error: string | null }>
  signUpWithSMS: (phone: string, code: string, name: string, email?: string, inviteCode?: string) => Promise<{ error: string | null }>
  signOut: () => void
  setToken: (token: string | null) => void
  updateAvatar: (file: File) => Promise<{ error: string | null }>
  updateName: (name: string) => Promise<{ error: string | null }>
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ error: string | null }>
}

export interface AuthStoreConfig {
  api: KyInstance
  tokenKey?: string
  onSignIn?: (token: string, user: User) => void
  onSignOut?: () => void
}

export function createAuthStore(config: AuthStoreConfig) {
  const tokenKey = config.tokenKey ?? DEFAULT_TOKEN_KEY

  function getStoredToken(): string | null {
    try { return localStorage.getItem(tokenKey) } catch { return null }
  }

  function storeToken(token: string | null) {
    try {
      if (token) localStorage.setItem(tokenKey, token)
      else localStorage.removeItem(tokenKey)
    } catch { /* SSR or private mode */ }
  }

  return createStore<AuthState>()((set, get) => ({
    user: null,
    token: getStoredToken(),
    loading: true,

    init: async () => {
      const token = get().token
      if (!token) {
        set({ loading: false })
        return
      }
      try {
        const user = await config.api.get('auth/me').json<User>()
        set({ user, loading: false })
        config.onSignIn?.(token, user)
      } catch {
        storeToken(null)
        set({ user: null, token: null, loading: false })
      }
    },

    signIn: async (email, password) => {
      try {
        const data = await config.api.post('auth/login', {
          json: { email, password },
        }).json<AuthResponse>()
        storeToken(data.token)
        set({ user: data.user, token: data.token })
        config.onSignIn?.(data.token, data.user)
        return { error: null }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Login failed' }
      }
    },

    sendSMSCode: async (phone, purpose, options) => {
      try {
        const data = await config.api.post('auth/sms/send', {
          json: { phone, purpose, invite_code: options?.inviteCode },
        }).json<{ purpose?: 'login' | 'register' }>()
        return { error: null, purpose: data.purpose || purpose }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'SMS send failed' }
      }
    },

    signInWithSMS: async (phone, code) => {
      try {
        const data = await config.api.post('auth/sms/login', {
          json: { phone, code },
        }).json<AuthResponse>()
        storeToken(data.token)
        set({ user: data.user, token: data.token })
        config.onSignIn?.(data.token, data.user)
        return { error: null }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Login failed' }
      }
    },

    signUp: async (email, password, name, inviteCode) => {
      try {
        const data = await config.api.post('auth/register', {
          json: { email, password, name, invite_code: inviteCode },
        }).json<AuthResponse>()
        storeToken(data.token)
        set({ user: data.user, token: data.token })
        config.onSignIn?.(data.token, data.user)
        return { error: null }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Registration failed' }
      }
    },

    signUpWithSMS: async (phone, code, name, email, inviteCode) => {
      try {
        const data = await config.api.post('auth/sms/register', {
          json: { phone, code, name, email, invite_code: inviteCode },
        }).json<AuthResponse>()
        storeToken(data.token)
        set({ user: data.user, token: data.token })
        config.onSignIn?.(data.token, data.user)
        return { error: null }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Registration failed' }
      }
    },

    signOut: () => {
      storeToken(null)
      set({ user: null, token: null })
      config.onSignOut?.()
    },

    setToken: (token) => {
      storeToken(token)
      set({ token })
    },

    updateAvatar: async (file) => {
      try {
        const form = new FormData()
        form.append('avatar', file)
        const res = await config.api.put('profile/avatar', { body: form }).json<{ avatar_url: string }>()
        const user = get().user
        if (user) set({ user: { ...user, avatar_url: res.avatar_url } })
        return { error: null }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Upload failed' }
      }
    },

    updateName: async (name) => {
      try {
        const updated = await config.api.put('profile', { json: { name } }).json<User>()
        set({ user: updated })
        return { error: null }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Update failed' }
      }
    },

    changePassword: async (oldPassword, newPassword) => {
      try {
        await config.api.put('profile/password', { json: { old_password: oldPassword, new_password: newPassword } })
        return { error: null }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Password change failed' }
      }
    },
  }))
}

export type AuthStore = ReturnType<typeof createAuthStore>
