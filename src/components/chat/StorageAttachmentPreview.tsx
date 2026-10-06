import { useEffect, useMemo, useState } from 'react'
import { Archive, Code2, CornerDownLeft, Download, ExternalLink, File, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation, RotateCw, X } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { storageAttachmentDownloadPayload, storagePresignDownloadPayload, storagePreviewPresignPayload } from '../../lib/storage-presign.js'
import { fileNameFromStorageRef, keyFromStorageRef, storageRefDisplayText } from '../../lib/storage-ref.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import type { StorageObject } from '../../core/types.js'
import { shareStorageProbe } from '../../lib/storage-probe-flight.js'
import { useRetryAfter } from '../../hooks/use-retry-after.js'

interface Props {
  channelId: string
  refs: string[]
  compact?: boolean
  onReference?: (refText: string) => void
}

export type StorageFileKind = 'image' | 'pdf' | 'html' | 'text' | 'code' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'audio' | 'video' | 'file'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'])
const HTML_EXTS = new Set(['html', 'htm'])
const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'env', 'log', 'conf', 'config'])
const CODE_EXTS = new Set([
  'js', 'jsx', 'mjs', 'cjs',
  'ts', 'tsx',
  'css', 'scss', 'sass', 'less', 'styl',
  'html', 'htm', 'xml',
  'py', 'pyw', 'ipynb',
  'go', 'rs', 'java', 'kt', 'kts', 'swift', 'scala',
  'c', 'cc', 'cpp', 'cxx', 'h', 'hh', 'hpp', 'hxx',
  'cs', 'fs', 'fsx',
  'php', 'rb', 'r', 'lua', 'pl', 'pm',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'sql', 'graphql', 'gql', 'prisma',
  'vue', 'svelte', 'astro',
])
const CODE_FILENAMES = new Set(['dockerfile', 'makefile', 'rakefile', 'gemfile', 'procfile'])
const DOCUMENT_EXTS = new Set(['docx'])
const SHEET_EXTS = new Set(['xls', 'xlsx', 'numbers'])
const PRESENTATION_EXTS = new Set(['ppt', 'pptx', 'key', 'odp'])
const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'm4v', 'f4v', 'flv'])

function uniqueRefs(refs: string[]) {
  return refs.filter((ref, i) => refs.indexOf(ref) === i)
}

function normalizedRef(ref: string) {
  return `storage://${encodeURI(keyFromStorageRef(ref).replace(/^\/+/, ''))}`
}

const STORAGE_REF_EXISTENCE_RETRY_DELAYS_MS = [0, 250, 750, 1500] as const

function storageRefCacheKey(channelId: string, refText: string) {
  return `${channelId}\u0000${keyFromStorageRef(refText)}`
}

function storageRefProbeShouldRetry(error: unknown) {
  const failure = error as { status?: number; response?: { status?: number } } | null
  const status = failure?.status ?? failure?.response?.status
  return status === undefined || status >= 500
}

export async function probeStorageRefExistence(
  check: () => Promise<unknown>,
  wait: (delayMs: number) => Promise<void> = (delayMs) => new Promise((resolve) => window.setTimeout(resolve, delayMs)),
) {
  for (let attempt = 0; attempt < STORAGE_REF_EXISTENCE_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = STORAGE_REF_EXISTENCE_RETRY_DELAYS_MS[attempt] ?? 0
    if (delayMs > 0) await wait(delayMs)

    try {
      await check()
      return true
    } catch (error) {
      const lastAttempt = attempt === STORAGE_REF_EXISTENCE_RETRY_DELAYS_MS.length - 1
      if (lastAttempt || !storageRefProbeShouldRetry(error)) return false
    }
  }

  return false
}

export function useExistingStorageRefs(channelId: string, refs: string[]) {
  const { api, config } = useBeeSeedContext()
  let session: string | null = null
  try { session = localStorage.getItem(config.tokenKey ?? 'beeseed_token') } catch { /* 与 API 客户端一致，存储不可用时不读取凭据。 */ }
  const refsKey = JSON.stringify(uniqueRefs(refs).map(normalizedRef))
  const unique = useMemo<string[]>(() => JSON.parse(refsKey), [refsKey])
  const [existing, setExisting] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false

    if (unique.length === 0) {
      setExisting(new Set())
      return
    }

    if (config.useMockData) {
      setExisting(new Set(unique))
      return
    }

    const next = new Set<string>()
    const pending: Promise<void>[] = []

    for (const refText of unique) {
      const cacheKey = storageRefCacheKey(channelId, refText)
      pending.push(
        shareStorageProbe(api, session, cacheKey, () => probeStorageRefExistence(() => api.post(`channels/${channelId}/storage/presign-download`, {
          json: storagePresignDownloadPayload(keyFromStorageRef(refText)),
        }).json<{ url: string }>()))
          .then((exists) => {
            if (!exists) return
            next.add(refText)
          }),
      )
    }

    setExisting(new Set(next))
    void Promise.allSettled(pending).then(() => {
      if (!cancelled) setExisting(new Set(next))
    })

    return () => { cancelled = true }
  }, [api, channelId, config.useMockData, unique, session])

  const isExistingRef = (refText: string) => existing.has(normalizedRef(refText))
  return { existingRefs: unique.filter((refText) => existing.has(refText)), isExistingRef }
}

function extOf(ref: string) {
  const name = fileNameFromStorageRef(ref)
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

function baseNameOf(ref: string) {
  return fileNameFromStorageRef(ref).toLowerCase()
}

export function storageFileKindForRef(ref: string): StorageFileKind {
  const ext = extOf(ref)
  const baseName = baseNameOf(ref)
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (HTML_EXTS.has(ext)) return 'html'
  if (DOCUMENT_EXTS.has(ext)) return 'document'
  if (SHEET_EXTS.has(ext)) return 'spreadsheet'
  if (PRESENTATION_EXTS.has(ext)) return 'presentation'
  if (CODE_FILENAMES.has(baseName)) return 'code'
  if (CODE_EXTS.has(ext)) return 'code'
  if (ARCHIVE_EXTS.has(ext)) return 'archive'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (TEXT_EXTS.has(ext)) return 'text'
  return 'file'
}

export function storageFileIconForKind(kind: StorageFileKind) {
  switch (kind) {
  case 'image': return FileImage
  case 'pdf':
  case 'text': return FileText
  case 'document': return FileText
  case 'html':
  case 'code': return Code2
  case 'spreadsheet': return FileSpreadsheet
  case 'presentation': return Presentation
  case 'archive': return Archive
  case 'audio': return FileAudio
  case 'video': return FileVideo
  default: return File
  }
}

export function storageFileLabel(kind: StorageFileKind, ext: string) {
  if (kind === 'pdf') return 'PDF'
  if (kind === 'image') return ext.toUpperCase() || '图片'
  if (kind === 'html') return 'HTML'
  if (kind === 'code') return ext.toUpperCase() || '代码'
  if (kind === 'document') return ext.toUpperCase() || 'Word 文档'
  if (kind === 'spreadsheet') return ext.toUpperCase() || '表格'
  if (kind === 'presentation') return ext.toUpperCase() || '演示文稿'
  if (kind === 'archive') return ext.toUpperCase() || '压缩包'
  if (kind === 'audio') return ext.toUpperCase() || '音频'
  if (kind === 'video') return ext.toUpperCase() || '视频'
  if (kind === 'text') return ext.toUpperCase() || '文本'
  return ext.toUpperCase() || '文件'
}

function isOfficeOnlinePreview(kind: StorageFileKind, ext: string) {
  return kind === 'presentation' || (kind === 'document' && ext === 'docx') || (kind === 'spreadsheet' && ext === 'xlsx')
}

export function storageFileCanPreview(kind: StorageFileKind, ext = '') {
  return kind === 'image' || kind === 'pdf' || kind === 'html' || kind === 'text' || kind === 'code' || isOfficeOnlinePreview(kind, ext) || kind === 'audio' || kind === 'video'
}

export function storagePreviewUsesProxy(kind: StorageFileKind, ext = '') {
  return kind === 'pdf' || kind === 'html' || kind === 'text' || kind === 'code' || isOfficeOnlinePreview(kind, ext)
}

function storagePreviewEndpointForKind(kind: StorageFileKind, ext: string) {
  if (isOfficeOnlinePreview(kind, ext)) return 'presentation-preview'
  if (kind === 'pdf') return 'pdf-preview'
  if (kind === 'html') return 'html-preview'
  if (kind === 'text' || kind === 'code') return 'text-preview'
  return null
}

function dirnameOfKey(key: string) {
  const idx = key.lastIndexOf('/')
  return idx >= 0 ? key.slice(0, idx + 1) : ''
}

function basenameOfKey(key: string) {
  return key.split('/').filter(Boolean).pop() || key
}

function storageObjectMatchesKey(obj: StorageObject, requestedKey: string) {
  const requestedBase = basenameOfKey(requestedKey)
  return obj.key === requestedKey
    || obj.name === requestedKey
    || obj.display_name === requestedKey
    || obj.key.endsWith(`/${requestedBase}`)
    || obj.name === requestedBase
    || obj.display_name === requestedBase
}

async function resolvePreviewKey(api: ReturnType<typeof useBeeSeedContext>['api'], channelId: string, requestedKey: string) {
  const prefix = dirnameOfKey(requestedKey)
  const prefixes = prefix ? [prefix, ''] : ['']
  const seen = new Set<string>()

  for (const candidatePrefix of prefixes) {
    if (seen.has(candidatePrefix)) continue
    seen.add(candidatePrefix)
    const data = await api.get(`channels/${channelId}/storage`, {
      searchParams: candidatePrefix ? { prefix: candidatePrefix } : {},
    }).json<{ objects?: StorageObject[] }>()
    const match = (data.objects ?? []).find((obj) => storageObjectMatchesKey(obj, requestedKey))
    if (match?.key) return match.key
  }

  return requestedKey
}

export async function requestStoragePreviewURL(
  api: ReturnType<typeof useBeeSeedContext>['api'],
  channelId: string,
  refText: string,
  kind: StorageFileKind,
  objectId?: string,
) {
  const proxyEndpoint = storagePreviewEndpointForKind(kind, extOf(refText))
  const requestForKey = (key: string) => proxyEndpoint
    ? api.post(`channels/${channelId}/storage/${proxyEndpoint}`, {
      json: storagePresignDownloadPayload(key, { objectId }),
    }).json<{ url: string }>()
    : api.post(`channels/${channelId}/storage/presign-download`, {
      json: storagePreviewPresignPayload(`storage://${key}`, objectId),
    }).json<{ url: string }>()

  const requestedKey = keyFromStorageRef(refText)
  try {
    return await requestForKey(requestedKey)
  } catch (err) {
    const failure = err as { status?: number; response?: { status?: number } } | null
    const status = failure?.status ?? failure?.response?.status
    if (status !== 404) throw err
    if (objectId) throw err
    const resolvedKey = await resolvePreviewKey(api, channelId, requestedKey)
    if (resolvedKey === requestedKey) throw err
    return requestForKey(resolvedKey)
  }
}

function officeOnlinePreviewURL(fileURL: string) {
  const absoluteURL = new URL(fileURL, window.location.origin).toString()
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteURL)}`
}

const OFFICE_PREVIEW_GUIDANCE_DELAY_MS = 30_000

function OfficeOnlinePreview({
  url,
  name,
  kind,
  attempt,
  downloading,
  onReload,
  onDownload,
}: {
  url: string
  name: string
  kind: Extract<StorageFileKind, 'document' | 'spreadsheet' | 'presentation'>
  attempt: number
  downloading: boolean
  onReload: () => void
  onDownload: () => void
}) {
  const [showGuidance, setShowGuidance] = useState(false)
  const officeUrl = officeOnlinePreviewURL(url)
  const OfficeIcon = kind === 'spreadsheet' ? FileSpreadsheet : kind === 'document' ? FileText : Presentation
  const typeLabel = kind === 'spreadsheet' ? 'Excel 表格' : kind === 'document' ? 'Word 文档' : '演示文稿'

  useEffect(() => {
    setShowGuidance(false)
    const timeoutId = window.setTimeout(() => setShowGuidance(true), OFFICE_PREVIEW_GUIDANCE_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [attempt, url])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded border border-[#e5e5e5] bg-white px-3 py-2 text-xs text-[#5f6b7a]">
        <OfficeIcon className="h-4 w-4 shrink-0 text-[#254fad]" />
        <span className="min-w-0 basis-[calc(100%-1.5rem)] sm:flex-1 sm:basis-auto">正在使用 Office 在线预览：{typeLabel}。</span>
        <button
          type="button"
          onClick={onReload}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#d8dde6] px-2 font-medium text-[#333840] hover:bg-[#f8fafc]"
        >
          <RotateCw className="h-3.5 w-3.5" />
          重新加载预览
        </button>
        <button
          type="button"
          onClick={() => window.open(officeUrl, '_blank', 'noopener,noreferrer')}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#d8dde6] px-2 font-medium text-[#333840] hover:bg-[#f8fafc]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          新窗口打开
        </button>
      </div>
      {showGuidance && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-[#d8dde6] bg-white px-3 py-2 text-xs text-[#41454d]">
          <span className="min-w-0 basis-full sm:flex-1 sm:basis-auto">如果预览仍为空白，可能是 Office 在线预览暂时未完成。可重新加载预览或下载原文件。</span>
          <button
            type="button"
            onClick={onReload}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#9297a0] bg-white px-3 font-medium text-[#181d26] hover:bg-[#f8fafc]"
          >
            <RotateCw className="h-3.5 w-3.5" />
            重新加载
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#181d26] px-3 font-medium text-white hover:bg-[#0d1218] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? '正在创建链接...' : '下载原文件'}
          </button>
        </div>
      )}
      <iframe
        key={attempt}
        src={officeUrl}
        title={name}
        className="h-[70vh] w-full rounded border border-[#e5e5e5] bg-white"
        allowFullScreen
      />
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading}
        className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[#181d26] px-3 text-sm font-medium text-white hover:bg-[#0d1218] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {downloading ? '正在创建链接...' : '下载原文件'}
      </button>
    </div>
  )
}

export function StorageFileIcon({ refText, className }: { refText: string; className?: string }) {
  const Icon = storageFileIconForKind(storageFileKindForRef(refText))
  return <Icon className={className} />
}

export function storageFileLabelForRef(refText: string) {
  return storageFileLabel(storageFileKindForRef(refText), extOf(refText))
}

function launchStorageDownload(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function openStorageDownload(
  requestURL: () => Promise<string>,
  fileName: string,
  launchDownload: (url: string, fileName: string) => void = launchStorageDownload,
) {
  const url = await requestURL()
  if (!url) throw new Error('下载链接为空')

  // Blob downloads work in full Chrome but are commonly ignored by embedded
  // browsers. Keep the attachment response as a real browser navigation so
  // the host can handle Content-Disposition, and return the short-lived URL so
  // the UI can offer a user-gesture retry/copy fallback.
  launchDownload(url, fileName)
  return url
}

function StorageDownloadNotice({ url, fileName }: { url: string; fileName: string }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-2 border-b border-[#e5e5e5] bg-[#f8fafc] px-4 py-2 text-xs text-[#5f6b7a]">
      <span>下载已发起。内置浏览器没有保存文件时，可再次打开或复制临时链接到主浏览器。</span>
      <a
        href={url}
        download={fileName}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[#254fad] underline underline-offset-2"
      >
        再次下载
      </a>
      <button type="button" onClick={() => void copyLink()} className="font-medium text-[#254fad] underline underline-offset-2">
        复制临时下载链接
      </button>
      {copyStatus === 'copied' && <span>已复制</span>}
      {copyStatus === 'failed' && <span role="alert" className="text-destructive">复制失败，请使用“再次下载”。</span>}
    </div>
  )
}

export function StoragePreviewDialog({ channelId, refText, objectId, onClose }: { channelId: string; refText: string; objectId?: string; onClose: () => void }) {
  const { api, config } = useBeeSeedContext()
  const { remainingSeconds, handleRateLimit, isCoolingDown } = useRetryAfter()
  const name = fileNameFromStorageRef(refText)
  const kind = storageFileKindForRef(refText)
  const ext = extOf(refText)
  const Icon = storageFileIconForKind(kind)
  const [url, setUrl] = useState<string | null>(null)
  const [htmlPreviewUrl, setHtmlPreviewUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadURL, setDownloadURL] = useState<string | null>(null)
  const [officeAttempt, setOfficeAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setHtmlPreviewUrl(null)
    setText(null)
    setLoading(true)
    setError(null)
    setDownloadError(null)
    setDownloadURL(null)

    if (config.useMockData) {
      setLoading(false)
      setError(storageFileCanPreview(kind, ext) ? '当前是模拟数据，无法加载文件内容。' : '此文件类型暂不支持预览。')
      return
    }

    const previewURLRequest = requestStoragePreviewURL(api, channelId, refText, kind, objectId)

    void previewURLRequest
      .then(async (data) => {
        if (cancelled) return
        setUrl(data.url)
        if (kind === 'text' || kind === 'code') {
          const resp = await fetch(data.url)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const body = await resp.text()
          if (!cancelled) setText(body)
        } else if (kind === 'html') {
          if (!cancelled) setHtmlPreviewUrl(data.url)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(handleRateLimit(err) ? '请求过于频繁，请稍后重试。' : err instanceof Error ? err.message : '预览加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [api, config.useMockData, ext, kind, refText, objectId, channelId, officeAttempt, handleRateLimit])

  const reloadOfficePreview = () => {
    if (isCoolingDown()) return
    setUrl(null)
    setLoading(true)
    setError(null)
    setOfficeAttempt((attempt) => attempt + 1)
  }

  const download = async () => {
    if (config.useMockData || downloading || isCoolingDown()) return
    setDownloading(true)
    setDownloadError(null)
    setDownloadURL(null)
    try {
      const nextDownloadURL = await openStorageDownload(async () => {
        const key = objectId
          ? keyFromStorageRef(refText)
          : await resolvePreviewKey(api, channelId, keyFromStorageRef(refText))
        const data = await api.post(`channels/${channelId}/storage/presign-download`, {
          json: storageAttachmentDownloadPayload(key, objectId),
        }).json<{ url: string }>()
        return data.url
      }, name)
      setDownloadURL(nextDownloadURL)
    } catch (err) {
      setDownloadError(handleRateLimit(err) ? '请求过于频繁，请稍后重试。' : '文件下载失败，请稍后重试。')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6" onClick={onClose}>
      <div
        className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#e5e5e5] px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#f8fafc] text-[#254fad]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[#1a1a1a]">{name}</div>
            <div className="text-[10px] text-[#777169]">{storageFileLabel(kind, ext)}</div>
          </div>
          {url && (
            <button
              type="button"
              onClick={() => void download()}
              disabled={downloading || remainingSeconds > 0}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#666] hover:bg-black/5 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="下载文件"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#666] hover:bg-black/5 hover:text-black"
            aria-label="关闭预览"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {downloadURL && <StorageDownloadNotice url={downloadURL} fileName={name} />}
        {downloadError && <div role="alert" className="border-b border-[#e5e5e5] px-4 py-2 text-xs text-destructive">{downloadError}{remainingSeconds > 0 && ` 请等待 ${remainingSeconds} 秒。`}</div>}

        <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-[#777169]">正在加载预览...</div>
          ) : error ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <Icon className="h-9 w-9 text-[#9aa1aa]" />
              <div className="text-sm font-medium text-[#333840]">无法预览此文件</div>
              <div role="alert" className="max-w-sm text-xs text-[#777169]">{error}{remainingSeconds > 0 && ` 请等待 ${remainingSeconds} 秒。`}</div>
              {isOfficeOnlinePreview(kind, ext) && !config.useMockData && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={reloadOfficePreview}
                    disabled={remainingSeconds > 0}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#9297a0] bg-white px-3 text-xs font-medium text-[#181d26] hover:bg-[#f8fafc]"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    重新加载预览
                  </button>
                  <button
                    type="button"
                    onClick={() => void download()}
                    disabled={downloading || remainingSeconds > 0}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#181d26] px-3 text-xs font-medium text-white hover:bg-[#0d1218] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloading ? '正在创建链接...' : '下载原文件'}
                  </button>
                </div>
              )}
            </div>
          ) : kind === 'image' && url ? (
            <img src={url} alt={name} className="mx-auto max-h-[70vh] max-w-full rounded bg-white object-contain" />
          ) : kind === 'pdf' && url ? (
            <iframe src={url} title={name} className="h-[70vh] w-full rounded border border-[#e5e5e5] bg-white" />
          ) : kind === 'html' && htmlPreviewUrl ? (
            <iframe
              src={htmlPreviewUrl}
              title={name}
              sandbox="allow-scripts"
              className="h-[70vh] w-full rounded border border-[#e5e5e5] bg-white"
            />
          ) : isOfficeOnlinePreview(kind, ext) && url ? (
            <OfficeOnlinePreview
              url={url}
              name={name}
              kind={kind as Extract<StorageFileKind, 'document' | 'spreadsheet' | 'presentation'>}
              attempt={officeAttempt}
              downloading={downloading || remainingSeconds > 0}
              onReload={reloadOfficePreview}
              onDownload={() => void download()}
            />
          ) : kind === 'audio' && url ? (
            <div className="flex h-48 items-center justify-center">
              <audio controls src={url} className="w-full max-w-xl" />
            </div>
          ) : kind === 'video' && url ? (
            <video controls src={url} className="mx-auto max-h-[70vh] max-w-full rounded bg-black" />
          ) : kind === 'text' && text !== null && (ext === 'md' || ext === 'markdown') ? (
            <div className="rounded bg-white px-5 py-4">
              <MarkdownRenderer content={text} className="prose prose-sm max-w-none" />
            </div>
          ) : (kind === 'text' || kind === 'code') && text !== null ? (
            <pre className="max-h-[70vh] overflow-auto rounded bg-white p-4 text-xs leading-relaxed text-[#1f2933]">{text}</pre>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <Icon className="h-9 w-9 text-[#9aa1aa]" />
              <div className="text-sm font-medium text-[#333840]">无法预览此文件</div>
              <div className="text-xs text-[#777169]">当前文件类型不支持在线预览。</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StorageImageAttachment({ channelId, refText, onReference }: { channelId: string; refText: string; onReference?: (refText: string) => void }) {
  const { api, config } = useBeeSeedContext()
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const name = fileNameFromStorageRef(refText)
  const displayText = storageRefDisplayText(refText)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setFailed(false)
    if (config.useMockData) return
    void api.post(`channels/${channelId}/storage/presign-download`, {
      json: storagePreviewPresignPayload(refText),
    }).json<{ url: string }>()
      .then((data) => { if (!cancelled) setUrl(data.url) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [api, config.useMockData, refText, channelId])

  if (failed) {
    return null
  }

  return (
    <>
      <div className="group/storage-file relative w-fit max-w-full">
        <button
          type="button"
          title={displayText}
          onClick={() => setPreviewOpen(true)}
          className="group relative block max-w-full overflow-hidden rounded-md border border-[#d8dde6] bg-[#f8fafc] text-left"
        >
          {url ? (
            <img
              src={url}
              alt={name}
              className="max-h-56 w-full max-w-[360px] object-contain bg-[#f8fafc]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-32 w-56 items-center justify-center text-[#9aa1aa]">
              <FileImage className="h-8 w-8" />
            </div>
          )}
          <div className="flex items-center gap-1.5 border-t border-[#e5e7eb] bg-white/95 px-2 py-1.5 text-xs text-[#333840]">
            <FileImage className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
            <span className="min-w-0 break-all">{displayText}</span>
            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-[#888] opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </button>
        {onReference && (
          <button
            type="button"
            title="引用到聊天"
            aria-label={`引用文件到聊天：${displayText}`}
            onClick={() => onReference(refText)}
            className="absolute right-2 top-2 inline-flex h-8 items-center gap-1 rounded-md border border-[#dddddd] bg-white px-2 text-xs font-medium text-[#181d26] shadow-sm opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9] md:opacity-0 md:group-hover/storage-file:opacity-100 md:group-focus-within/storage-file:opacity-100"
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
            引用
          </button>
        )}
      </div>
      {previewOpen && <StoragePreviewDialog channelId={channelId} refText={refText} onClose={() => setPreviewOpen(false)} />}
    </>
  )
}

function StorageFileAttachment({ channelId, refText, onReference }: { channelId: string; refText: string; onReference?: (refText: string) => void }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const displayText = storageRefDisplayText(refText)
  const kind = storageFileKindForRef(refText)
  const ext = extOf(refText)
  const Icon = storageFileIconForKind(kind)

  return (
    <>
      <div className="group/storage-file flex max-w-full items-center gap-1 rounded-md border border-[#d8dde6] bg-[#f8fafc] px-1.5 py-1.5 transition-colors hover:border-[#aeb6c2] hover:bg-white">
        <button
          type="button"
          title={displayText}
          onClick={() => setPreviewOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white text-[#254fad]">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-all text-sm font-medium text-[#333840]">{displayText}</span>
            <span className="block text-[10px] text-[#777169]">{storageFileCanPreview(kind, ext) ? storageFileLabel(kind, ext) : `${storageFileLabel(kind, ext)} · 无法预览`}</span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-[#888]" />
        </button>
        {onReference && (
          <button
            type="button"
            title="引用到聊天"
            aria-label={`引用文件到聊天：${displayText}`}
            onClick={() => onReference(refText)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-[#dddddd] bg-white px-2 text-xs font-medium text-[#181d26] opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9] md:opacity-0 md:group-hover/storage-file:opacity-100 md:group-focus-within/storage-file:opacity-100"
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
            引用
          </button>
        )}
      </div>
      {previewOpen && <StoragePreviewDialog channelId={channelId} refText={refText} onClose={() => setPreviewOpen(false)} />}
    </>
  )
}

export function StorageAttachmentPreview({ channelId, refs, compact, onReference }: Props) {
  const { existingRefs: items } = useExistingStorageRefs(channelId, refs)
  if (items.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-2', compact ? 'mt-1' : 'mt-2')}>
      {items.map((refText) => (
        storageFileKindForRef(refText) === 'image'
          ? <StorageImageAttachment key={refText} channelId={channelId} refText={refText} onReference={onReference} />
          : <StorageFileAttachment key={refText} channelId={channelId} refText={refText} onReference={onReference} />
      ))}
    </div>
  )
}
