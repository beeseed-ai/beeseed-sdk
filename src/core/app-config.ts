import type { AppBrandingConfig, AppRuntimeConfig } from './types.js'

export interface ResolvedAppBrandingConfig {
  title: string
  pageTitle: string
  description: string
  welcomeMessage: string
  inputPlaceholder: string
  logo?: string
  favicon?: string
}

export const DEFAULT_APP_BRANDING: ResolvedAppBrandingConfig = {
  title: 'BeeSeed',
  pageTitle: 'BeeSeed',
  description: '你的 AI 协作空间',
  welcomeMessage: '你好！有什么可以帮助你的？',
  inputPlaceholder: '输入消息...',
}

function clean(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function resolveAppBranding(config?: AppRuntimeConfig): ResolvedAppBrandingConfig {
  const branding: AppBrandingConfig = config?.branding ?? {}
  const title = clean(branding.title) ?? DEFAULT_APP_BRANDING.title
  const description = clean(branding.description) ?? DEFAULT_APP_BRANDING.description

  return {
    title,
    pageTitle: clean(branding.pageTitle) ?? title,
    description,
    welcomeMessage: clean(branding.welcomeMessage) ?? DEFAULT_APP_BRANDING.welcomeMessage,
    inputPlaceholder: clean(branding.inputPlaceholder) ?? DEFAULT_APP_BRANDING.inputPlaceholder,
    logo: clean(branding.logo),
    favicon: clean(branding.favicon),
  }
}

export function applyDocumentBranding(branding: ResolvedAppBrandingConfig) {
  if (typeof document === 'undefined') return

  document.title = branding.pageTitle

  const favicon = branding.favicon
  if (!favicon) return

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = favicon
}
