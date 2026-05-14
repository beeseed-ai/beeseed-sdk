import type { StorageObject } from '../core/types.js'

const GENERATED_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i

export function storageDisplayName(obj: StorageObject): string {
  const explicit = obj.display_name || obj.name
  if (explicit) return explicit

  const base = obj.key.split('/').pop() || obj.key
  const match = base.match(GENERATED_PREFIX_RE)
  return match?.[1] || base
}
