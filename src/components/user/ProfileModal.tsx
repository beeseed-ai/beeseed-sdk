import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, X } from 'lucide-react'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Dialog } from '../ui/dialog.js'
import { Button } from '../ui/button.js'
import type { AppRuntimeConfig } from '../../core/types.js'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type HiveProfileMessage = {
  type?: string
}

const TOKEN_QUERY_KEYS = ['beeseed_launch_token', 'beeseed_token', 'token', 'auth_token', 'access_token']
const SIGNED_OUT_KEYS = ['signed_out', 'logout', 'logged_out']

export function ProfileModal({ open, onOpenChange }: Props) {
  const { authStore, config } = useBeeSeedContext()
  const [loading, setLoading] = useState(true)
  const profileURL = useMemo(() => buildHiveProfileURL(config.appConfig), [config.appConfig])
  const profileOrigin = useMemo(() => {
    if (!profileURL) return null
    try {
      return new URL(profileURL).origin
    } catch {
      return null
    }
  }, [profileURL])

  useEffect(() => {
    if (open) setLoading(true)
  }, [open, profileURL])

  useEffect(() => {
    if (!open || !profileOrigin) return

    function handleMessage(event: MessageEvent) {
      if (event.origin !== profileOrigin) return
      const data = typeof event.data === 'object' && event.data !== null
        ? event.data as HiveProfileMessage
        : null
      if (!data?.type) return

      if (data.type === 'beeseed:hive-profile-close') {
        onOpenChange(false)
        return
      }
      if (data.type === 'beeseed:hive-profile-updated') {
        void authStore.getState().init()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [authStore, onOpenChange, open, profileOrigin])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="flex h-[min(760px,calc(100dvh-2rem))] w-[min(880px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-[#dddddd] bg-white shadow-xl">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e5e5e5] px-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[#181d26]">个人中心</div>
            <div className="truncate text-xs text-[#69707a]">由 Hive 平台统一管理账户资料和安全设置</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {profileURL && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => window.open(profileURL, '_blank', 'noopener,noreferrer')}
                aria-label="在新窗口打开个人中心"
                title="在新窗口打开"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="关闭个人中心"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-white">
          {profileURL ? (
            <>
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white text-sm text-[#69707a]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载个人中心...
                </div>
              )}
              <iframe
                title="Hive 个人中心"
                src={profileURL}
                className="h-full w-full border-0"
                onLoad={() => setLoading(false)}
                allow="clipboard-write"
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center">
              <div>
                <div className="text-sm font-medium text-[#181d26]">无法打开 Hive 个人中心</div>
                <div className="mt-2 max-w-sm text-sm leading-6 text-[#69707a]">
                  当前应用缺少 Hive 平台入口配置。请检查应用运行配置中的 platform.external_url。
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function buildHiveProfileURL(appConfig?: AppRuntimeConfig): string | null {
  if (typeof window === 'undefined') return null
  const platformURL = platformExternalURL(appConfig)
  if (!platformURL) return null

  const url = new URL('/profile', platformURL)
  url.searchParams.set('embed', '1')
  url.searchParams.set('return_to', appReturnTo())
  url.searchParams.set('origin', window.location.origin)
  return url.toString()
}

function platformExternalURL(appConfig?: AppRuntimeConfig): string | null {
  const configured = appConfig?.platform?.external_url?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window === 'undefined') return null

  const { protocol, hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null

  const parts = hostname.split('.').filter(Boolean)
  if (parts.length < 2) return null
  parts[0] = 'hive'
  return `${protocol}//${parts.join('.')}`
}

function appReturnTo(): string {
  const url = new URL(window.location.href)
  removeParams(url.searchParams, TOKEN_QUERY_KEYS)
  removeParams(url.searchParams, SIGNED_OUT_KEYS)

  const hashText = url.hash.charAt(0) === '#' ? url.hash.slice(1) : url.hash
  const hashParams = new URLSearchParams(hashText.charAt(0) === '?' ? hashText.slice(1) : hashText)
  let changedHash = false
  for (const key of [...TOKEN_QUERY_KEYS, ...SIGNED_OUT_KEYS]) {
    if (hashParams.has(key)) changedHash = true
    hashParams.delete(key)
  }
  if (changedHash) {
    const nextHash = hashParams.toString()
    url.hash = nextHash ? '#' + nextHash : ''
  }

  return url.toString()
}

function removeParams(params: URLSearchParams, keys: string[]) {
  for (const key of keys) params.delete(key)
}
