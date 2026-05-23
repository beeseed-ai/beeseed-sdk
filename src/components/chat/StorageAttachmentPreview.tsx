import { useEffect, useMemo, useState } from 'react'
import { Archive, Code2, Download, ExternalLink, File, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation, X } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { fileNameFromStorageRef, keyFromStorageRef } from '../../lib/storage-ref.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'

interface Props {
  channelId: string
  refs: string[]
  compact?: boolean
}

export type StorageFileKind = 'image' | 'pdf' | 'html' | 'text' | 'code' | 'spreadsheet' | 'presentation' | 'archive' | 'audio' | 'video' | 'file'

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

const storageRefExistenceCache = new Map<string, boolean>()

function storageRefCacheKey(channelId: string, refText: string) {
  return `${channelId}\u0000${keyFromStorageRef(refText)}`
}

export function useExistingStorageRefs(channelId: string, refs: string[]) {
  const { api, config } = useBeeSeedContext()
  const unique = useMemo(() => uniqueRefs(refs).map(normalizedRef), [refs])
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
      const cached = storageRefExistenceCache.get(cacheKey)
      if (cached === true) {
        next.add(refText)
        continue
      }

      pending.push(
        api.post(`channels/${channelId}/storage/presign-download`, {
          json: { key: keyFromStorageRef(refText) },
        }).json<{ url: string }>()
          .then(() => {
            storageRefExistenceCache.set(cacheKey, true)
            next.add(refText)
          })
          .catch(() => {}),
      )
    }

    setExisting(new Set(next))
    void Promise.allSettled(pending).then(() => {
      if (!cancelled) setExisting(new Set(next))
    })

    return () => { cancelled = true }
  }, [api, channelId, config.useMockData, unique])

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
  if (kind === 'spreadsheet') return ext.toUpperCase() || '表格'
  if (kind === 'presentation') return ext.toUpperCase() || '演示文稿'
  if (kind === 'archive') return ext.toUpperCase() || '压缩包'
  if (kind === 'audio') return ext.toUpperCase() || '音频'
  if (kind === 'video') return ext.toUpperCase() || '视频'
  if (kind === 'text') return ext.toUpperCase() || '文本'
  return ext.toUpperCase() || '文件'
}

export function storageFileCanPreview(kind: StorageFileKind) {
  return kind === 'image' || kind === 'pdf' || kind === 'html' || kind === 'text' || kind === 'code' || kind === 'presentation' || kind === 'audio' || kind === 'video'
}

function officePresentationViewerUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
}

export function StorageFileIcon({ refText, className }: { refText: string; className?: string }) {
  const Icon = storageFileIconForKind(storageFileKindForRef(refText))
  return <Icon className={className} />
}

export function storageFileLabelForRef(refText: string) {
  return storageFileLabel(storageFileKindForRef(refText), extOf(refText))
}

export function StoragePreviewDialog({ channelId, refText, onClose }: { channelId: string; refText: string; onClose: () => void }) {
  const { api, config } = useBeeSeedContext()
  const name = fileNameFromStorageRef(refText)
  const kind = storageFileKindForRef(refText)
  const ext = extOf(refText)
  const Icon = storageFileIconForKind(kind)
  const [url, setUrl] = useState<string | null>(null)
  const [htmlPreviewUrl, setHtmlPreviewUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setHtmlPreviewUrl(null)
    setText(null)
    setLoading(true)
    setError(null)

    if (config.useMockData) {
      setLoading(false)
      setError(storageFileCanPreview(kind) ? '当前是模拟数据，无法加载文件内容。' : '此文件类型暂不支持预览。')
      return
    }

    void api.post(`channels/${channelId}/storage/presign-download`, {
      json: { key: keyFromStorageRef(refText) },
    }).json<{ url: string }>()
      .then(async (data) => {
        if (cancelled) return
        setUrl(data.url)
        if (kind === 'text' || kind === 'code') {
          const resp = await fetch(data.url)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const body = await resp.text()
          if (!cancelled) setText(body)
        } else if (kind === 'html') {
          const preview = await api.post(`channels/${channelId}/storage/html-preview`, {
            json: { key: keyFromStorageRef(refText) },
          }).json<{ url: string }>()
          if (!cancelled) setHtmlPreviewUrl(preview.url)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '预览加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [api, config.useMockData, ext, kind, refText, channelId])

  const download = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  const presentationViewerUrl = kind === 'presentation' && url ? officePresentationViewerUrl(url) : null

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
              onClick={download}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#666] hover:bg-black/5 hover:text-black"
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

        <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-[#777169]">正在加载预览...</div>
          ) : error ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <Icon className="h-9 w-9 text-[#9aa1aa]" />
              <div className="text-sm font-medium text-[#333840]">无法预览此文件</div>
              <div className="max-w-sm text-xs text-[#777169]">{error}</div>
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
          ) : presentationViewerUrl ? (
            <div className="flex min-h-[70vh] flex-col gap-2">
              <iframe
                src={presentationViewerUrl}
                title={name}
                className="min-h-0 flex-1 rounded border border-[#e5e5e5] bg-white"
              />
              <div className="text-center text-xs text-[#777169]">如果演示文稿未能加载，请使用右上角按钮打开原文件。</div>
            </div>
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

function StorageImageAttachment({ channelId, refText }: { channelId: string; refText: string }) {
  const { api, config } = useBeeSeedContext()
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const name = fileNameFromStorageRef(refText)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setFailed(false)
    if (config.useMockData) return
    void api.post(`channels/${channelId}/storage/presign-download`, {
      json: { key: keyFromStorageRef(refText) },
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
      <button
        type="button"
        title={keyFromStorageRef(refText)}
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
          <span className="min-w-0 truncate">{name}</span>
          <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-[#888] opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </button>
      {previewOpen && <StoragePreviewDialog channelId={channelId} refText={refText} onClose={() => setPreviewOpen(false)} />}
    </>
  )
}

function StorageFileAttachment({ channelId, refText }: { channelId: string; refText: string }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const name = fileNameFromStorageRef(refText)
  const kind = storageFileKindForRef(refText)
  const ext = extOf(refText)
  const Icon = storageFileIconForKind(kind)

  return (
    <>
      <button
        type="button"
        title={keyFromStorageRef(refText)}
        onClick={() => setPreviewOpen(true)}
        className={cn(
          'flex max-w-full items-center gap-2 rounded-md border border-[#d8dde6] bg-[#f8fafc] px-2.5 py-2 text-left transition-colors hover:border-[#aeb6c2] hover:bg-white',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white text-[#254fad]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[#333840]">{name}</span>
          <span className="block text-[10px] text-[#777169]">{storageFileCanPreview(kind) ? storageFileLabel(kind, ext) : `${storageFileLabel(kind, ext)} · 无法预览`}</span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-[#888]" />
      </button>
      {previewOpen && <StoragePreviewDialog channelId={channelId} refText={refText} onClose={() => setPreviewOpen(false)} />}
    </>
  )
}

export function StorageAttachmentPreview({ channelId, refs, compact }: Props) {
  const { existingRefs: items } = useExistingStorageRefs(channelId, refs)
  if (items.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-2', compact ? 'mt-1' : 'mt-2')}>
      {items.map((refText) => (
        storageFileKindForRef(refText) === 'image'
          ? <StorageImageAttachment key={refText} channelId={channelId} refText={refText} />
          : <StorageFileAttachment key={refText} channelId={channelId} refText={refText} />
      ))}
    </div>
  )
}
