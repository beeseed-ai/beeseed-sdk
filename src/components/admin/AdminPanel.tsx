import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Bot, Check, Copy, Download, ExternalLink, Image, LayoutTemplate, MessageSquare, QrCode, Settings, Users } from 'lucide-react'
import * as QRCode from 'qrcode'
import type { AppBrandingConfig, AppRuntimeConfig, PublicHomeConfig, PublicHomeMetric, PublicHomeTemplateID, PublicHomeTextBlock } from '../../core/types.js'
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
  { id: 'homepage', label: '公开主页', icon: LayoutTemplate },
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
        {activeTab === 'homepage' && <PublicHomeSettings />}
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

type PublicHomeTemplateDefaults = Pick<PublicHomeConfig,
  'eyebrow' | 'title' | 'subtitle' | 'primary_cta' | 'secondary_cta' | 'features' |
  'audiences' | 'capabilities' | 'workflow' | 'metrics' | 'closing_title' | 'closing_subtitle'
>

const PUBLIC_HOME_TEMPLATES: {
  id: PublicHomeTemplateID
  label: string
  description: string
  accent: string
  defaults: PublicHomeTemplateDefaults
}[] = [
  {
    id: 'ai_workspace',
    label: '企业效率',
    description: '适合内部工具、团队协作、AI 工作台。',
    accent: '#181d26',
    defaults: {
      eyebrow: 'AI 工作台',
      title: '把知识、任务和团队协作放进同一个 App',
      subtitle: '为团队提供统一的 AI 入口，让成员从分享链接注册后直接进入专属工作空间。',
      primary_cta: '注册并进入',
      secondary_cta: '已有账号登录',
      features: ['多 Agent 协作', '知识库问答', '任务持续推进', '文档自动整理', '成员权限管理'],
      audiences: ['需要统一 AI 入口的管理团队', '有大量内部文档和流程的运营团队', '按项目交付结果的服务团队', '希望沉淀经验的新业务团队'],
      capabilities: [
        { title: '团队知识入口', description: '把制度、方案、客户资料和历史对话沉淀到同一个 App，成员用自然语言即可检索和追问。' },
        { title: '任务推进面板', description: '从对话中拆出待办、负责人和截止时间，让 AI 持续跟进交付状态。' },
        { title: '多角色协作', description: '为研究、运营、客服、项目管理配置不同 Agent，减少反复切换工具。' },
        { title: '可追溯工作记录', description: '每次讨论、文件和结论都保留在频道里，便于复盘和新人接手。' },
      ],
      workflow: [
        { title: '注册进入专属工作台', description: '成员从分享链接注册后自动进入当前 App，不需要重新寻找入口。' },
        { title: '选择频道和 Agent', description: '按项目、客户或主题建立频道，让合适的 Agent 参与协作。' },
        { title: '沉淀结果并继续推进', description: '把输出转成任务、资料和长期记忆，下次进入可以接着工作。' },
      ],
      metrics: [
        { value: '3 分钟', label: '搭建团队 AI 入口' },
        { value: '24/7', label: '持续响应成员问题' },
        { value: '1 个链接', label: '完成分享、注册和归因' },
      ],
      closing_title: '让每个团队都有自己的 AI 协作入口',
      closing_subtitle: '公开主页负责介绍价值和承接注册，登录后的 App 负责知识、任务和成员协作。',
    },
  },
  {
    id: 'education',
    label: '教育培训',
    description: '适合课程、训练营、一对一导师。',
    accent: '#d9a441',
    defaults: {
      eyebrow: '学习空间',
      title: '让每个学员进入自己的 AI 学习主页',
      subtitle: '公开页承接课程介绍、注册入口和学习目标，登录后进入专属辅导与任务跟踪。',
      primary_cta: '加入学习',
      secondary_cta: '学员登录',
      features: ['学习诊断', '测验复习', '成长报告', '课程资料问答', '作业跟进'],
      audiences: ['课程训练营和陪跑社群', '职业考试和证书培训', '一对一导师服务', '企业内训和知识转化项目'],
      capabilities: [
        { title: '入学诊断', description: '通过问答快速了解学员基础、目标和薄弱点，为后续学习路径提供依据。' },
        { title: '课程资料问答', description: '把课件、讲义和案例放进知识库，学员随时追问重点和细节。' },
        { title: '复习测验', description: '围绕章节生成题目、错题解析和复习建议，让学习从听课延伸到练习。' },
        { title: '成长记录', description: '持续记录学员问题、任务和反馈，老师可以看到真实学习进度。' },
      ],
      workflow: [
        { title: '了解课程价值', description: '公开主页说明课程适合谁、能解决什么问题，以及进入后的学习方式。' },
        { title: '注册进入学习空间', description: '学员注册后自动进入对应 App，保留来源 App 和分享信息。' },
        { title: '诊断、学习、复盘', description: '从诊断开始，围绕资料问答、任务练习和阶段报告形成闭环。' },
      ],
      metrics: [
        { value: '5 类', label: '学习内容自动组织' },
        { value: '随时', label: '课后追问和复习' },
        { value: '闭环', label: '诊断到报告持续跟踪' },
      ],
      closing_title: '把课程介绍页升级成学习入口',
      closing_subtitle: '让公开访问、注册归因、课程问答和学习跟进在同一个 App 中完成。',
    },
  },
  {
    id: 'consulting',
    label: '专业咨询',
    description: '适合顾问、研究、医疗、法律等专业服务。',
    accent: '#0a2e0e',
    defaults: {
      eyebrow: '专家服务',
      title: '把专业服务交付成可持续跟进的 AI 空间',
      subtitle: '客户从公开页了解服务范围，注册后进入安全的咨询、资料和任务协同环境。',
      primary_cta: '开始咨询',
      secondary_cta: '客户登录',
      features: ['资料收集', '过程记录', '交付跟进', '风险提示', '方案沉淀'],
      audiences: ['顾问和研究团队', '医疗、法律、财税等专业服务', '需要持续交付的客户成功团队', '高客单价咨询项目'],
      capabilities: [
        { title: '结构化资料收集', description: '把客户背景、附件、问题和目标集中到频道，减少来回补信息。' },
        { title: '专业过程记录', description: '咨询判断、依据、补充问题和交付结论保留在上下文中，便于审阅。' },
        { title: '交付任务跟踪', description: '把下一步动作、负责人和时间点形成任务，降低服务中断风险。' },
        { title: '方案资产沉淀', description: '把重复出现的问题、案例和交付模板沉淀成团队知识资产。' },
      ],
      workflow: [
        { title: '客户了解服务范围', description: '公开主页说明适用场景、服务边界和进入后的协作方式。' },
        { title: '注册并提交背景', description: '客户进入 App 后补充资料，团队能看到来源 App 和访客会话。' },
        { title: '持续咨询与交付', description: '围绕频道完成追问、文件、结论和下一步任务管理。' },
      ],
      metrics: [
        { value: '清晰', label: '服务边界和进入路径' },
        { value: '可追溯', label: '每次判断和交付记录' },
        { value: '持续', label: '后续任务不丢失' },
      ],
      closing_title: '让专业服务从一次沟通变成持续交付',
      closing_subtitle: '用公开主页承接客户，用 App 管理资料、过程和后续行动。',
    },
  },
  {
    id: 'community',
    label: '社群知识',
    description: '适合会员社区、内容社群、知识库门户。',
    accent: '#a8d8c4',
    defaults: {
      eyebrow: '会员社区',
      title: '为成员提供一个持续更新的知识入口',
      subtitle: '把内容、问答、任务和成员协作集中到 App，公开页负责承接新成员注册。',
      primary_cta: '加入社区',
      secondary_cta: '会员登录',
      features: ['知识沉淀', '成员协作', '长期陪伴', '活动通知', '内容导航'],
      audiences: ['会员社群和付费社区', '内容创作者的粉丝知识库', '行业学习小组', '品牌客户社区'],
      capabilities: [
        { title: '内容导航', description: '把文章、课程、直播回放和资料组织成可问答的知识入口。' },
        { title: '成员问答', description: '新成员可以先问 AI，管理员再处理高价值问题，减少重复答疑。' },
        { title: '社群任务', description: '把打卡、活动、共创和长期项目变成可跟进任务。' },
        { title: '社区资产沉淀', description: '高频问题、优质回答和案例持续沉淀，形成越用越强的社区记忆。' },
      ],
      workflow: [
        { title: '公开页介绍社群价值', description: '让新成员知道能获得什么内容、服务和陪伴。' },
        { title: '注册进入会员空间', description: '从 App 链接注册后直接进入社区，归因到具体 App 和分享来源。' },
        { title: '问答、参与、沉淀', description: '成员围绕内容提问、参与任务，社区持续积累知识。' },
      ],
      metrics: [
        { value: '长期', label: '内容和问答持续沉淀' },
        { value: '低重复', label: '减少管理员重复答疑' },
        { value: '可运营', label: '活动和任务统一跟进' },
      ],
      closing_title: '让社群拥有一个能持续增长的知识主页',
      closing_subtitle: '公开页负责介绍和转化，App 内负责问答、活动和成员关系。',
    },
  },
  {
    id: 'creative',
    label: '内容创作',
    description: '适合自媒体、营销、设计和创意团队。',
    accent: '#aa2d00',
    defaults: {
      eyebrow: '创作工作流',
      title: '从灵感到交付，建立你的 AI 创作空间',
      subtitle: '公开页展示创作服务与案例，注册后进入素材、任务和生成流程的统一界面。',
      primary_cta: '开始创作',
      secondary_cta: '团队登录',
      features: ['选题策划', '素材管理', '内容生成', '审稿协作', '发布复盘'],
      audiences: ['自媒体和内容团队', '营销活动和品牌团队', '设计、视频、文案工作室', '需要稳定输出的创作者'],
      capabilities: [
        { title: '选题策划', description: '从热点、用户问题和品牌目标出发，组织选题池与内容方向。' },
        { title: '素材管理', description: '把案例、图片、访谈、竞品和历史稿件沉淀为可检索素材库。' },
        { title: '生成与改写', description: '围绕不同平台和语气生成初稿、标题、脚本和分发文案。' },
        { title: '审稿复盘', description: '把修改意见、发布结果和复盘结论留在频道，形成团队风格记忆。' },
      ],
      workflow: [
        { title: '展示创作服务或项目', description: '公开主页说明服务内容、协作方式和进入后的工作流。' },
        { title: '注册进入创作空间', description: '客户或团队成员从链接进入后，围绕项目开始协作。' },
        { title: '策划、生产、复盘', description: '从选题到发布后的反馈都在同一个 App 中持续沉淀。' },
      ],
      metrics: [
        { value: '一站式', label: '选题到复盘完整链路' },
        { value: '多平台', label: '适配图文、视频和营销物料' },
        { value: '可复用', label: '素材和风格持续沉淀' },
      ],
      closing_title: '把创意协作变成稳定输出的工作流',
      closing_subtitle: '公开主页承接需求，App 内完成素材、任务、生成和审稿协作。',
    },
  },
]

const PUBLIC_HOME_TEMPLATE_IDS = new Set(PUBLIC_HOME_TEMPLATES.map((template) => template.id))
const DEFAULT_PUBLIC_HOME_TEMPLATE = PUBLIC_HOME_TEMPLATES[0]!

function publicHomeTemplate(id: string | undefined) {
  return PUBLIC_HOME_TEMPLATES.find((template) => template.id === id) ?? DEFAULT_PUBLIC_HOME_TEMPLATE
}

function defaultPublicHome(): PublicHomeConfig {
  const template = DEFAULT_PUBLIC_HOME_TEMPLATE
  return {
    enabled: true,
    template: template.id,
    ...template.defaults,
  }
}

function normalizeStringList(items: string[] | undefined, maxItems: number): string[] {
  return (items ?? []).map((item) => item.trim()).filter(Boolean).slice(0, maxItems)
}

function normalizeTextBlocks(items: PublicHomeTextBlock[] | undefined, maxItems: number): PublicHomeTextBlock[] {
  return (items ?? []).map((item) => ({
    title: item.title?.trim() ?? '',
    description: item.description?.trim() ?? '',
  })).filter((item) => item.title).slice(0, maxItems)
}

function normalizeMetrics(items: PublicHomeMetric[] | undefined, maxItems: number): PublicHomeMetric[] {
  return (items ?? []).map((item) => ({
    value: item.value?.trim() ?? '',
    label: item.label?.trim() ?? '',
  })).filter((item) => item.value && item.label).slice(0, maxItems)
}

function listToText(items: string[] | undefined, fallback: string[] | undefined): string {
  return normalizeStringList(items && items.length > 0 ? items : fallback, 8).join('\n')
}

function blocksToText(items: PublicHomeTextBlock[] | undefined, fallback: PublicHomeTextBlock[] | undefined): string {
  return normalizeTextBlocks(items && items.length > 0 ? items : fallback, 6)
    .map((item) => item.description ? `${item.title}｜${item.description}` : item.title)
    .join('\n')
}

function metricsToText(items: PublicHomeMetric[] | undefined, fallback: PublicHomeMetric[] | undefined): string {
  return normalizeMetrics(items && items.length > 0 ? items : fallback, 4)
    .map((item) => `${item.value}｜${item.label}`)
    .join('\n')
}

function parseListText(text: string, maxItems: number): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, maxItems)
}

function parseTextBlockText(text: string, maxItems: number): PublicHomeTextBlock[] {
  return text.split('\n').map((line) => {
    const [title, ...descriptionParts] = line.split(/[｜|]/)
    return {
      title: title?.trim() ?? '',
      description: descriptionParts.join('｜').trim(),
    }
  }).filter((item) => item.title).slice(0, maxItems)
}

function parseMetricText(text: string, maxItems: number): PublicHomeMetric[] {
  return text.split('\n').map((line) => {
    const [value, ...labelParts] = line.split(/[｜|]/)
    return {
      value: value?.trim() ?? '',
      label: labelParts.join('｜').trim(),
    }
  }).filter((item) => item.value && item.label).slice(0, maxItems)
}

function compactPublicHome(home: PublicHomeConfig): PublicHomeConfig {
  const template = publicHomeTemplate(home.template).id
  const clean: PublicHomeConfig = {
    enabled: home.enabled !== false,
    template: PUBLIC_HOME_TEMPLATE_IDS.has(template) ? template : DEFAULT_PUBLIC_HOME_TEMPLATE.id,
  }
  for (const key of ['eyebrow', 'title', 'subtitle', 'cover_image_url', 'primary_cta', 'secondary_cta', 'closing_title', 'closing_subtitle'] as const) {
    const value = home[key]
    if (typeof value === 'string' && value.trim()) clean[key] = value.trim()
  }
  const features = normalizeStringList(home.features, 5)
  if (features.length > 0) clean.features = features
  const audiences = normalizeStringList(home.audiences, 8)
  if (audiences.length > 0) clean.audiences = audiences
  const capabilities = normalizeTextBlocks(home.capabilities, 6)
  if (capabilities.length > 0) clean.capabilities = capabilities
  const workflow = normalizeTextBlocks(home.workflow, 5)
  if (workflow.length > 0) clean.workflow = workflow
  const metrics = normalizeMetrics(home.metrics, 4)
  if (metrics.length > 0) clean.metrics = metrics
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

function PublicHomeSettings() {
  const { api, updateAppConfig } = useBeeSeedContext()
  const { appConfig } = useAppConfig()
  const [home, setHome] = useState<PublicHomeConfig>(() => appConfig.public_home ?? defaultPublicHome())
  const [featuresText, setFeaturesText] = useState(() => (appConfig.public_home?.features ?? defaultPublicHome().features ?? []).join('\n'))
  const [audiencesText, setAudiencesText] = useState(() => listToText(appConfig.public_home?.audiences, defaultPublicHome().audiences))
  const [capabilitiesText, setCapabilitiesText] = useState(() => blocksToText(appConfig.public_home?.capabilities, defaultPublicHome().capabilities))
  const [workflowText, setWorkflowText] = useState(() => blocksToText(appConfig.public_home?.workflow, defaultPublicHome().workflow))
  const [metricsText, setMetricsText] = useState(() => metricsToText(appConfig.public_home?.metrics, defaultPublicHome().metrics))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  function syncEditorText(next: PublicHomeConfig) {
    const template = publicHomeTemplate(next.template)
    setFeaturesText(listToText(next.features, template.defaults.features))
    setAudiencesText(listToText(next.audiences, template.defaults.audiences))
    setCapabilitiesText(blocksToText(next.capabilities, template.defaults.capabilities))
    setWorkflowText(blocksToText(next.workflow, template.defaults.workflow))
    setMetricsText(metricsToText(next.metrics, template.defaults.metrics))
  }

  useEffect(() => {
    api.get('admin/settings/frontend').json<AppRuntimeConfig>().then((data) => {
      const next = data.public_home ?? appConfig.public_home ?? defaultPublicHome()
      setHome(next)
      syncEditorText(next)
      setLoading(false)
    }).catch(() => {
      const fallback = appConfig.public_home ?? defaultPublicHome()
      setHome(fallback)
      syncEditorText(fallback)
      setLoading(false)
    })
  }, [api, appConfig.public_home])

  function updateHome(patch: Partial<PublicHomeConfig>) {
    setHome((current) => ({ ...current, ...patch }))
  }

  function selectTemplate(templateID: PublicHomeTemplateID) {
    const template = publicHomeTemplate(templateID)
    const next: PublicHomeConfig = {
      enabled: home.enabled !== false,
      cover_image_url: home.cover_image_url,
      template: template.id,
      ...template.defaults,
    }
    setHome(next)
    syncEditorText(next)
  }

  async function persist(nextHome: PublicHomeConfig) {
    const payload: AppRuntimeConfig = { public_home: compactPublicHome(nextHome) }
    const updated = await api.patch('admin/settings/frontend', { json: payload }).json<AppRuntimeConfig>()
    const updatedHome = updated.public_home ?? payload.public_home ?? defaultPublicHome()
    setHome(updatedHome)
    syncEditorText(updatedHome)
    updateAppConfig(updated)
    window.dispatchEvent(new CustomEvent('beeseed:app-config-updated', { detail: updated }))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
    return updated
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      const nextHome = {
        ...home,
        features: parseListText(featuresText, 5),
        audiences: parseListText(audiencesText, 8),
        capabilities: parseTextBlockText(capabilitiesText, 6),
        workflow: parseTextBlockText(workflowText, 5),
        metrics: parseMetricText(metricsText, 4),
      }
      await persist(nextHome)
    } finally {
      setSaving(false)
    }
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.set('kind', 'cover')
      form.set('asset', file)
      const result = await api.post('admin/settings/frontend/assets', { body: form }).json<{ url: string }>()
      const nextHome = { ...home, cover_image_url: result.url }
      setHome(nextHome)
      await persist(nextHome)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full overflow-hidden bg-[#fafafa]">
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground shadow-sm">加载公开主页设置...</div>
        </div>
      </div>
    )
  }

  const template = publicHomeTemplate(home.template)
  const previewTitle = home.title || template.defaults.title || appConfig.branding?.title || 'App'
  const previewSubtitle = home.subtitle || template.defaults.subtitle || appConfig.branding?.description || ''
  const previewFeatures = parseListText(featuresText, 5)
  const previewCapabilities = parseTextBlockText(capabilitiesText, 6)
  const previewMetrics = parseMetricText(metricsText, 4)

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#1a1a1a]">公开主页</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">配置未登录用户打开 App 链接时看到的行业主页、注册入口和转化内容。</p>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? '保存中...' : saved ? '已保存' : '保存公开主页'}
            </Button>
          </div>

          <section className="space-y-5 rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-[#fafafa] text-[#555]">
                <LayoutTemplate className="size-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">行业模板</h2>
                <p className="mt-1 text-xs text-[#777]">选择模板会套用该行业的完整默认内容，封面图会保留。</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PUBLIC_HOME_TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTemplate(item.id)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    template.id === item.id ? 'border-[#181d26] bg-[#f8fafc]' : 'border-border bg-white hover:bg-[#fafafa]',
                  )}
                >
                  <span className="mb-2 block h-1.5 w-10 rounded-full" style={{ backgroundColor: item.accent }} />
                  <span className="block text-sm font-medium text-[#181d26]">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#777]">{item.description}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="space-y-6">
              <section className="space-y-4 rounded-lg border border-border bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-sm font-semibold">首屏内容</h2>
                  <p className="mt-1 text-xs text-[#777]">决定用户打开 App 链接第一眼看到的定位、标题和行动按钮。</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-border bg-[#fafafa] px-3 py-2 text-sm text-[#181d26]">
                    <input
                      type="checkbox"
                      checked={home.enabled !== false}
                      onChange={(event) => updateHome({ enabled: event.target.checked })}
                    />
                    启用公开主页
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm hover:bg-[#f8f8f8]">
                      <Image className="size-4" />
                      {uploading ? '上传中...' : '上传封面图'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(event) => { void uploadCover(event.target.files?.[0]); event.target.value = '' }}
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-xs text-[#777]">{home.cover_image_url || '未上传'}</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#555]">标签</label>
                    <Input value={home.eyebrow ?? ''} onChange={(event) => updateHome({ eyebrow: event.target.value })} placeholder={template.defaults.eyebrow} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#555]">标题</label>
                    <Input value={home.title ?? ''} onChange={(event) => updateHome({ title: event.target.value })} placeholder={template.defaults.title} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#555]">说明</label>
                  <textarea
                    value={home.subtitle ?? ''}
                    onChange={(event) => updateHome({ subtitle: event.target.value })}
                    rows={3}
                    placeholder={template.defaults.subtitle}
                    className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#999]"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#555]">主按钮</label>
                    <Input value={home.primary_cta ?? ''} onChange={(event) => updateHome({ primary_cta: event.target.value })} placeholder={template.defaults.primary_cta} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#555]">次按钮</label>
                    <Input value={home.secondary_cta ?? ''} onChange={(event) => updateHome({ secondary_cta: event.target.value })} placeholder={template.defaults.secondary_cta} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#555]">首屏亮点，每行一个，最多 5 个</label>
                  <textarea
                    value={featuresText}
                    onChange={(event) => setFeaturesText(event.target.value)}
                    rows={4}
                    placeholder={(template.defaults.features ?? []).join('\n')}
                    className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#999]"
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-sm font-semibold">内容模块</h2>
                  <p className="mt-1 text-xs text-[#777]">用更完整的内容解释适合谁、能做什么、如何开始。</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#555]">适用对象，每行一个</label>
                  <textarea
                    value={audiencesText}
                    onChange={(event) => setAudiencesText(event.target.value)}
                    rows={4}
                    placeholder={(template.defaults.audiences ?? []).join('\n')}
                    className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#999]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#555]">能力模块，每行：标题｜说明</label>
                  <textarea
                    value={capabilitiesText}
                    onChange={(event) => setCapabilitiesText(event.target.value)}
                    rows={7}
                    placeholder={blocksToText(template.defaults.capabilities, undefined)}
                    className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#999]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#555]">使用流程，每行：步骤｜说明</label>
                  <textarea
                    value={workflowText}
                    onChange={(event) => setWorkflowText(event.target.value)}
                    rows={5}
                    placeholder={blocksToText(template.defaults.workflow, undefined)}
                    className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#999]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#555]">指标/承诺，每行：数值｜说明</label>
                  <textarea
                    value={metricsText}
                    onChange={(event) => setMetricsText(event.target.value)}
                    rows={4}
                    placeholder={metricsToText(template.defaults.metrics, undefined)}
                    className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#999]"
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-sm font-semibold">收尾转化</h2>
                  <p className="mt-1 text-xs text-[#777]">页面底部再次解释价值，推动用户注册或登录。</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#555]">收尾标题</label>
                  <Input value={home.closing_title ?? ''} onChange={(event) => updateHome({ closing_title: event.target.value })} placeholder={template.defaults.closing_title} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#555]">收尾说明</label>
                  <textarea
                    value={home.closing_subtitle ?? ''}
                    onChange={(event) => updateHome({ closing_subtitle: event.target.value })}
                    rows={3}
                    placeholder={template.defaults.closing_subtitle}
                    className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-[#999]"
                  />
                </div>
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <div className="overflow-hidden rounded-lg border border-border bg-[#f8fafc] shadow-sm">
                {home.cover_image_url ? (
                  <img src={home.cover_image_url} alt="" className="h-36 w-full object-cover" />
                ) : (
                  <div className="h-36 w-full" style={{ backgroundColor: template.accent }} />
                )}
                <div className="space-y-3 bg-white p-4">
                  <div className="text-xs font-medium text-[#777]">{home.eyebrow || template.defaults.eyebrow}</div>
                  <div className="text-lg font-medium leading-6 text-[#181d26]">{previewTitle}</div>
                  <div className="text-sm leading-5 text-[#555]">{previewSubtitle}</div>
                  <div className="flex flex-wrap gap-2">
                    {previewFeatures.map((feature) => (
                      <span key={feature} className="rounded-md border border-border bg-white px-2 py-1 text-xs text-[#333840]">{feature}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-md bg-[#181d26] px-3 py-2 text-center text-xs font-medium text-white">{home.primary_cta || template.defaults.primary_cta}</div>
                    <div className="rounded-md border border-border bg-white px-3 py-2 text-center text-xs font-medium text-[#181d26]">{home.secondary_cta || template.defaults.secondary_cta}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
                <div className="text-xs font-medium text-[#777]">内容预览</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {previewMetrics.map((metric) => (
                    <div key={`${metric.value}-${metric.label}`} className="rounded-md border border-border bg-[#fafafa] p-2">
                      <div className="text-sm font-semibold text-[#181d26]">{metric.value}</div>
                      <div className="mt-1 text-[11px] leading-4 text-[#777]">{metric.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {previewCapabilities.slice(0, 3).map((item) => (
                    <div key={item.title} className="rounded-md border border-border p-3">
                      <div className="text-xs font-medium text-[#181d26]">{item.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#777]">{item.description}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <div className="text-xs font-medium text-[#181d26]">{home.closing_title || template.defaults.closing_title}</div>
                  <div className="mt-1 text-xs leading-5 text-[#777]">{home.closing_subtitle || template.defaults.closing_subtitle}</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
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
