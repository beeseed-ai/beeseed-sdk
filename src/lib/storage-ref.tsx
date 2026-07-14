import { FileText } from 'lucide-react'
import { cn } from './cn.js'

export const STORAGE_REF_RE = /storage:\/\/[^\s)\]}>，。；：！？,;:!?]+/g
const STORAGE_PATH_RE = /(^|[\s([（「『【<])((?:[^\s)\]}>，。；：！？,;!?]+\/)+[^\s)\]}>，。；：！？,;!?]+\.(?:md|markdown|txt|pdf|doc|docx|xls|xlsx|ppt|pptx|csv|json|jsonl|yaml|yml|html|htm|png|jpg|jpeg|webp|gif|svg|zip|rar|7z|tar|gz|tgz|mp3|wav|m4a|mp4|mov|webm))(?![^\s)\]}>，。；：！？,;!?])/gi
const GENERATED_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i

export function storageRefFromKey(key: string) {
  return `storage://${encodeURI(key.replace(/^\/+/, ''))}`
}

export function keyFromStorageRef(ref: string) {
  const raw = ref.replace(/^storage:\/\//, '').replace(/^\/+/, '')
  try {
    return decodeURI(raw)
  } catch {
    return raw
  }
}

export function fileNameFromStorageRef(ref: string) {
  const key = keyFromStorageRef(ref)
  const base = key.split('/').filter(Boolean).pop() || '云存储文件'
  return base.match(GENERATED_PREFIX_RE)?.[1] || base
}

export interface StorageInlineRefMatch {
  rawText: string
  refText: string
  index: number
  length: number
}

function pushStoragePathMatches(text: string, matches: StorageInlineRefMatch[]) {
  STORAGE_PATH_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = STORAGE_PATH_RE.exec(text)) !== null) {
    const boundary = match[1] ?? ''
    const rawText = match[2] ?? ''
    if (!rawText || rawText.includes('://')) continue
    matches.push({
      rawText,
      refText: storageRefFromKey(rawText),
      index: match.index + boundary.length,
      length: rawText.length,
    })
  }
}

export function isLikelyStoragePathRef(text: string) {
  STORAGE_PATH_RE.lastIndex = 0
  const match = STORAGE_PATH_RE.exec(` ${text.trim()}`)
  return match?.[2] === text.trim() && !text.includes('://')
}

export function storageInlineRefMatches(text: string) {
  const matches: StorageInlineRefMatch[] = []
  STORAGE_REF_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = STORAGE_REF_RE.exec(text)) !== null) {
    matches.push({
      rawText: match[0],
      refText: storageRefFromKey(keyFromStorageRef(match[0])),
      index: match.index,
      length: match[0].length,
    })
  }
  pushStoragePathMatches(text, matches)

  const sorted = matches.sort((a, b) => a.index - b.index || b.length - a.length)
  const out: StorageInlineRefMatch[] = []
  let consumedUntil = -1
  for (const item of sorted) {
    if (item.index < consumedUntil) continue
    out.push(item)
    consumedUntil = item.index + item.length
  }
  return out
}

export function storageRefsFromText(text: string) {
  const refs: string[] = []
  for (const match of storageInlineRefMatches(text)) {
    if (!refs.includes(match.refText)) refs.push(match.refText)
  }
  return refs
}

function normalizeStorageRef(ref: string) {
  return storageRefFromKey(keyFromStorageRef(ref))
}

function shouldStripStorageRef(ref: string, refsToStrip?: Set<string>) {
  if (!refsToStrip) return true
  return refsToStrip.has(normalizeStorageRef(ref))
}

export function stripStorageReferenceBlock(text: string, refsToStrip?: Set<string>) {
  const lines = text.split('\n')
  const out: string[] = []
  let pendingReferenceLabel: string | null = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^引用文件[:：]?$/.test(trimmed)) {
      pendingReferenceLabel = line
      continue
    }

    const refMatch = trimmed.match(/^-?\s*(storage:\/\/\S+)\s*$/)
    if (refMatch?.[1] && shouldStripStorageRef(refMatch[1], refsToStrip)) {
      pendingReferenceLabel = null
      continue
    }

    if (pendingReferenceLabel !== null) {
      out.push(pendingReferenceLabel)
      pendingReferenceLabel = null
    }
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

interface StorageRefChipProps {
  refText: string
  className?: string
  onClick?: (key: string) => void
}

export function StorageRefChip({ refText, className, onClick }: StorageRefChipProps) {
  const key = keyFromStorageRef(refText)
  return (
    <button
      type="button"
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#d8dde6] bg-[#f8fafc] px-2 py-0.5 align-middle text-[0.9em] font-medium text-[#333840] transition-colors hover:border-[#9297a0] hover:bg-white',
        className,
      )}
      title={key}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.(key)
      }}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-[#254fad]" />
      <span className="min-w-0 truncate">{fileNameFromStorageRef(refText)}</span>
    </button>
  )
}
