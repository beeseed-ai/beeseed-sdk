import { FileText } from 'lucide-react'
import { cn } from './cn.js'

export const STORAGE_REF_RE = /storage:\/\/[^\s)\]}>]+/g

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
  return key.split('/').filter(Boolean).pop() || '云存储文件'
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
