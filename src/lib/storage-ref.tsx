import { FileText } from 'lucide-react'
import { cn } from './cn.js'

export const STORAGE_REF_RE = /storage:\/\/[^\s)\]}>，。；：！？,;:!?]+/g
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

export function storageRefsFromText(text: string) {
  const refs: string[] = []
  STORAGE_REF_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = STORAGE_REF_RE.exec(text)) !== null) {
    refs.push(match[0])
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
