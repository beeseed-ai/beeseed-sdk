import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Bot, Check, Copy, Download, ExternalLink, MessageSquare, QrCode, Settings, Users } from 'lucide-react'
import * as QRCode from 'qrcode'
import type { AppBrandingConfig, AppRuntimeConfig } from '../../core/types.js'
import { applyDocumentBranding, resolveAppBranding } from '../../core/app-config.js'
import { cn } from '../../lib/cn.js'
import { AgentManageTab } from './AgentManageTab.js'
import { UserManageTab } from './UserManageTab.js'
import { KnowledgeManageTab } from './KnowledgeManageTab.js'
import { ChannelManageTab } from './ChannelManageTab.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { useAppConfig } from '../../hooks/use-app-config.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'

const tabs = [
  { id: 'agents', label: 'Agent 管理', icon: Bot },
  { id: 'users', label: '成员管理', icon: Users },
  { id: 'channels', label: '频道管理', icon: MessageSquare },
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'settings', label: '设置', icon: Settings },
] as const

type TabId = (typeof tabs)[number]['id']

const ADMIN_TAB_STORAGE_KEY = 'beeseed_admin_active_tab'
const tabIds = new Set<TabId>(tabs.map((tab) => tab.id))

function isTabId(value: string | null): value is TabId {
  return value !== null && tabIds.has(value as TabId)
}

function getInitialAdminTab(): TabId {
  if (typeof window === 'undefined') return 'agents'
  try {
    const saved = window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY)
    if (isTabId(saved)) return saved
  } catch {
    // Ignore storage failures; the default tab is still stable.
  }
  return 'agents'
}

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialAdminTab)

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, activeTab)
    } catch {
      // Storage can be unavailable in private or embedded contexts.
    }
  }, [activeTab])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-white px-4 py-2">
        <h2 className="mr-4 shrink-0 text-sm font-semibold">管理面板</h2>
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                activeTab === tab.id
                  ? 'bg-[#f5f5f5] text-[#1a1a1a] font-medium'
                  : 'text-[#888] hover:text-[#555] hover:bg-[#fafafa]',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'agents' && <AgentManageTab />}
        {activeTab === 'users' && <UserManageTab />}
        {activeTab === 'channels' && <ChannelManageTab />}
        {activeTab === 'knowledge' && <KnowledgeManageTab />}
        {activeTab === 'settings' && <AppSettingsPanel />}
      </div>
    </div>
  )
}

const BRANDING_FIELDS: (keyof AppBrandingConfig)[] = [
  'title',
  'pageTitle',
  'logo',
  'favicon',
  'description',
  'welcomeMessage',
  'inputPlaceholder',
]

function compactBranding(branding: AppBrandingConfig): AppBrandingConfig {
  const clean: AppBrandingConfig = {}
  for (const key of BRANDING_FIELDS) {
    const value = branding[key]
    if (typeof value === 'string' && value.trim()) {
      clean[key] = value.trim()
    }
  }
  return clean
}

function AppSettingsPanel() {
  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a1a]">设置</h1>
            <p className="mt-1 text-sm text-muted-foreground">配置标准模板的品牌和频道策略。</p>
          </div>
          <AppShareSettings />
          <BrandSettings />
          <ChannelPolicySettings />
        </div>
      </div>
    </div>
  )
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall back to a temporary textarea below.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
  return copied
}

function AppShareSettings() {
  const appUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/`
  }, [])
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [qrError, setQrError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!appUrl) return

    let cancelled = false
    setQrCodeDataUrl('')
    setQrError('')
    QRCode.toDataURL(appUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: {
        dark: '#181d26',
        light: '#ffffff',
      },
    }).then((dataUrl) => {
      if (cancelled) return
      setQrCodeDataUrl(dataUrl)
    }).catch(() => {
      if (cancelled) return
      setQrError('二维码生成失败')
    })

    return () => {
      cancelled = true
    }
  }, [appUrl])

  async function copyLink() {
    if (!appUrl) return
    const ok = await copyTextToClipboard(appUrl)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  function downloadQrCode() {
    if (!qrCodeDataUrl) return
    const link = document.createElement('a')
    const hostname = window.location.hostname.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'app'
    link.href = qrCodeDataUrl
    link.download = `${hostname}-qrcode.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-[#fafafa] text-[#555]">
          <QrCode className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">分享</h3>
          <p className="mt-1 text-xs text-[#777]">把当前 App 链接生成二维码，方便成员扫码访问。</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#555]">App 链接</label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-[#fafafa] px-3 py-2 text-sm text-[#181d26]" title={appUrl}>
                {appUrl || '无法读取当前链接'}
              </div>
              <Button type="button" variant="outline" onClick={() => { void copyLink() }} disabled={!appUrl}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? '已复制' : '复制链接'}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadQrCode} disabled={!qrCodeDataUrl}>
              <Download className="size-4" />
              下载二维码
            </Button>
            <Button type="button" variant="ghost" onClick={() => window.open(appUrl, '_blank', 'noopener,noreferrer')} disabled={!appUrl}>
              <ExternalLink className="size-4" />
              打开链接
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-lg border border-border bg-[#fafafa] p-3">
          <div className="flex size-[172px] items-center justify-center rounded-md border border-border bg-white p-2">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="App 分享二维码" className="size-full object-contain" />
            ) : (
              <span className="px-3 text-center text-xs text-[#999]">{qrError || '正在生成二维码...'}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function BrandSettings() {
  const { api, updateAppConfig } = useBeeSeedContext()
  const { appConfig } = useAppConfig()
  const [branding, setBranding] = useState<AppBrandingConfig>(appConfig.branding ?? {})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null)

  useEffect(() => {
    api.get('admin/settings/frontend').json<AppRuntimeConfig>().then((data) => {
      setBranding(data.branding ?? appConfig.branding ?? {})
      setLoading(false)
    }).catch(() => {
      setBranding(appConfig.branding ?? {})
      setLoading(false)
    })
  }, [api, appConfig.branding])

  async function persistBranding(nextBranding: AppBrandingConfig) {
    const payload: AppRuntimeConfig = { branding: compactBranding(nextBranding) }
    const updated = await api.patch('admin/settings/frontend', { json: payload }).json<AppRuntimeConfig>()
    setBranding(updated.branding ?? {})
    updateAppConfig(updated)
    applyDocumentBranding(resolveAppBranding(updated))
    window.dispatchEvent(new CustomEvent('beeseed:app-config-updated', { detail: updated }))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
    return updated
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await persistBranding(branding)
    } finally {
      setSaving(false)
    }
  }

  function updateBranding(key: keyof AppBrandingConfig, value: string) {
    setBranding((current) => ({ ...current, [key]: value }))
  }

  async function uploadAsset(kind: 'logo' | 'favicon', file: File | undefined) {
    if (!file) return
    setUploading(kind)
    try {
      const form = new FormData()
      form.set('kind', kind)
      form.set('asset', file)
      const result = await api.post('admin/settings/frontend/assets', { body: form }).json<{ url: string }>()
      const nextBranding = { ...branding, [kind]: result.url }
      setBranding(nextBranding)
      await persistBranding(nextBranding)
    } finally {
      setUploading(null)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-border bg-white p-5 text-sm text-muted-foreground shadow-sm">加载品牌设置...</div>
  }

  const preview = resolveAppBranding({ branding })

  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold">品牌</h3>
        <p className="mt-1 text-xs text-[#777]">配置 App 名称、主页标题、Logo 和聊天入口文案。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#555]">品牌名</label>
          <Input value={branding.title ?? ''} onChange={(e) => updateBranding('title', e.target.value)} placeholder="BeeSeed" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#555]">主页标题</label>
          <Input value={branding.pageTitle ?? ''} onChange={(e) => updateBranding('pageTitle', e.target.value)} placeholder={preview.title} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#555]">Logo</label>
          <div className="flex items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-border bg-white px-3 text-sm hover:bg-[#f8f8f8]">
              {uploading === 'logo' ? '上传中...' : '上传 Logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
                className="hidden"
                onChange={(e) => { void uploadAsset('logo', e.target.files?.[0]); e.target.value = '' }}
              />
            </label>
            <span className="min-w-0 flex-1 truncate text-xs text-[#777]">{branding.logo || '未上传'}</span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#555]">Favicon</label>
          <div className="flex items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-border bg-white px-3 text-sm hover:bg-[#f8f8f8]">
              {uploading === 'favicon' ? '上传中...' : '上传 Favicon'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,.ico"
                className="hidden"
                onChange={(e) => { void uploadAsset('favicon', e.target.files?.[0]); e.target.value = '' }}
              />
            </label>
            <span className="min-w-0 flex-1 truncate text-xs text-[#777]">{branding.favicon || '未上传'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[#555]">描述</label>
        <Input value={branding.description ?? ''} onChange={(e) => updateBranding('description', e.target.value)} placeholder="你的 AI 协作空间" />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[#555]">欢迎语</label>
        <textarea
          value={branding.welcomeMessage ?? ''}
          onChange={(e) => updateBranding('welcomeMessage', e.target.value)}
          rows={2}
          placeholder="你好！有什么可以帮助你的？"
          className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#999]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[#555]">输入框提示</label>
        <Input value={branding.inputPlaceholder ?? ''} onChange={(e) => updateBranding('inputPlaceholder', e.target.value)} placeholder="输入消息..." />
      </div>

      <div className="rounded-md border border-border bg-[#fafaf8] p-3">
        <div className="mb-3 flex items-center gap-2">
          {preview.logo ? (
            <img src={preview.logo} alt={preview.title} className="h-10 w-auto max-w-[180px] rounded-md object-contain" />
          ) : (
            <div className="flex size-7 items-center justify-center rounded-md bg-[#181d26] text-xs font-medium text-white">
              {Array.from(preview.title)[0] || 'B'}
            </div>
          )}
          {!preview.logo && (
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[#181d26]">{preview.title}</div>
              <div className="truncate text-xs text-[#777]">{preview.description}</div>
            </div>
          )}
        </div>
        <div className="rounded-md border border-border bg-white p-3">
          <div className="text-sm font-medium text-[#181d26]">{preview.pageTitle}</div>
          <div className="mt-1 text-xs text-[#777]">浏览器标签标题</div>
          <div className="mt-3 rounded-md border border-border px-3 py-2 text-xs text-[#999]">{preview.inputPlaceholder}</div>
        </div>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? '保存中...' : saved ? '已保存' : '保存品牌设置'}
      </Button>
    </section>
  )
}

interface ChannelCreationPolicy {
  mode: 'all_users' | 'admin_only' | 'owner_only' | 'disabled'
  default_agent_ids: string[]
  max_channels_per_user: number
  require_purpose: boolean
  default_channel_type: string
}

function ChannelPolicySettings() {
  const { api } = useBeeSeedContext()
  const [policy, setPolicy] = useState<ChannelCreationPolicy>({
    mode: 'all_users',
    default_agent_ids: ['assistant'],
    max_channels_per_user: 0,
    require_purpose: false,
    default_channel_type: 'create',
  })
  const [agentText, setAgentText] = useState('assistant')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('admin/settings/channels').json<ChannelCreationPolicy>().then((data) => {
      setPolicy(data)
      setAgentText((data.default_agent_ids || []).join(', '))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [api])

  async function save() {
    setSaving(true)
    const next = {
      ...policy,
      default_agent_ids: agentText.split(',').map((item) => item.trim()).filter(Boolean),
      max_channels_per_user: Number(policy.max_channels_per_user) || 0,
      default_channel_type: policy.default_channel_type || 'create',
    }
    try {
      const saved = await api.patch('admin/settings/channels', { json: next }).json<ChannelCreationPolicy>()
      setPolicy(saved)
      setAgentText((saved.default_agent_ids || []).join(', '))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-border bg-white p-5 text-sm text-muted-foreground shadow-sm">加载频道策略...</div>
  }

  return (
    <section className="space-y-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold">频道策略</h3>
          <p className="mt-1 text-xs text-[#777]">控制谁可以手动创建频道，以及新频道默认加入哪些 Agent。</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-[#555]">谁可以创建频道</label>
          <select
            value={policy.mode}
            onChange={(e) => setPolicy({ ...policy, mode: e.target.value as ChannelCreationPolicy['mode'] })}
            className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-[#999]"
          >
            <option value="all_users">所有登录用户</option>
            <option value="admin_only">仅管理员</option>
            <option value="owner_only">仅 Owner</option>
            <option value="disabled">关闭手动创建</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-[#555]">默认 Agent</label>
          <Input value={agentText} onChange={(e) => setAgentText(e.target.value)} placeholder="assistant" />
          <div className="text-xs text-[#999]">多个 Agent 用英文逗号分隔。创建频道时会自动加入这些 Agent。</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#555]">每个普通用户最多创建</label>
            <Input
              type="number"
              min={0}
              value={policy.max_channels_per_user}
              onChange={(e) => setPolicy({ ...policy, max_channels_per_user: Number(e.target.value) })}
            />
            <div className="text-xs text-[#999]">0 表示不限制。</div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#555]">默认频道类型</label>
            <Input
              value={policy.default_channel_type}
              onChange={(e) => setPolicy({ ...policy, default_channel_type: e.target.value })}
              placeholder="create"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[#555]">
          <input
            type="checkbox"
            checked={policy.require_purpose}
            onChange={(e) => setPolicy({ ...policy, require_purpose: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          创建频道时必须填写用途
        </label>

        <Button onClick={save} disabled={saving}>
          {saving ? '保存中...' : '保存频道策略'}
        </Button>
    </section>
  )
}
