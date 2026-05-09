import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { StorageObject } from '../core/types.js'
import { MOCK_OBJECTS, MOCK_DIRECTORIES } from '../mocks/storage.js'

export interface StorageState {
  objects: StorageObject[]
  directories: string[]
  currentPrefix: string
  loading: boolean
  searchQuery: string
  previewObj: StorageObject | null

  browse: (roomId: string, prefix?: string) => Promise<void>
  deleteFile: (roomId: string, key: string) => Promise<void>
  setSearchQuery: (q: string) => void
  setPreviewObj: (obj: StorageObject | null) => void
  filteredObjects: () => StorageObject[]
  breadcrumbs: () => { label: string; prefix: string }[]
  reset: () => void
}

export interface StorageStoreConfig {
  api: KyInstance
  useMock?: boolean
}

export function createStorageStore(config: StorageStoreConfig) {
  return createStore<StorageState>()((set, get) => ({
    objects: [],
    directories: [],
    currentPrefix: '',
    loading: false,
    searchQuery: '',
    previewObj: null,

    browse: async (roomId, prefix = '') => {
      set({ loading: true, currentPrefix: prefix })
      if (config.useMock) {
        const pfx = prefix
        const dirs = MOCK_DIRECTORIES.filter((d) => d.startsWith(pfx) && d !== pfx)
          .map((d) => d.slice(pfx.length).split('/')[0] + '/')
          .filter((v, i, a) => a.indexOf(v) === i)
        const objs = MOCK_OBJECTS.filter((o) => o.key.startsWith(pfx) && !o.key.slice(pfx.length).includes('/'))
        set({ directories: dirs, objects: objs, loading: false })
        return
      }
      try {
        const data = await config.api.get(`rooms/${roomId}/storage`, { searchParams: prefix ? { prefix } : {} }).json<{ objects: StorageObject[]; common_prefixes: string[] }>()
        set({ objects: data.objects || [], directories: data.common_prefixes || [], loading: false })
      } catch { set({ loading: false }) }
    },

    deleteFile: async (roomId, key) => {
      if (config.useMock) { set({ objects: get().objects.filter((o) => o.key !== key) }); return }
      try {
        await config.api.delete(`rooms/${roomId}/storage/file/${encodeURIComponent(key)}`)
        set({ objects: get().objects.filter((o) => o.key !== key) })
      } catch { /* */ }
    },

    setSearchQuery: (q) => set({ searchQuery: q }),
    setPreviewObj: (obj) => set({ previewObj: obj }),

    filteredObjects: () => {
      const { objects, searchQuery } = get()
      if (!searchQuery) return objects
      const q = searchQuery.toLowerCase()
      return objects.filter((o) => o.key.toLowerCase().includes(q))
    },

    breadcrumbs: () => {
      const parts = get().currentPrefix.split('/').filter(Boolean)
      const crumbs = [{ label: '根目录', prefix: '' }]
      parts.forEach((p, i) => crumbs.push({ label: p, prefix: parts.slice(0, i + 1).join('/') + '/' }))
      return crumbs
    },

    reset: () => set({ objects: [], directories: [], currentPrefix: '', loading: false, searchQuery: '', previewObj: null }),
  }))
}

export type StorageStore = ReturnType<typeof createStorageStore>
