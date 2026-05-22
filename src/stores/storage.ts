import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type { StorageObject, StoragePolicy, StorageUsage } from '../core/types.js'
import { MOCK_OBJECTS, MOCK_DIRECTORIES } from '../mocks/storage.js'

export interface StorageState {
  objects: StorageObject[]
  directories: string[]
  currentPrefix: string
  loading: boolean
  uploading: boolean
  uploadProgress: number
  uploadError: string | null
  policy: StoragePolicy
  usage: StorageUsage
  canUpload: boolean
  searchQuery: string
  previewObj: StorageObject | null

  browse: (channelId: string, prefix?: string) => Promise<void>
  createDirectory: (channelId: string, name: string, prefix?: string) => Promise<void>
  uploadFile: (channelId: string, file: File, prefix?: string) => Promise<StorageObject | null>
  downloadFile: (channelId: string, key: string) => Promise<string | null>
  deleteFile: (channelId: string, key: string) => Promise<void>
  clearUploadError: () => void
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
    uploading: false,
    uploadProgress: 0,
    uploadError: null,
    policy: { enabled: true, visibility: 'channel', members_can_upload: true, members_can_delete_own: true },
    usage: { objects: 0, bytes: 0 },
    canUpload: true,
    searchQuery: '',
    previewObj: null,

    browse: async (channelId, prefix = '') => {
      set({ loading: true, currentPrefix: prefix })
      if (config.useMock) {
        const pfx = prefix
        const dirs = MOCK_DIRECTORIES.filter((d) => d.startsWith(pfx) && d !== pfx)
          .map((d) => d.slice(pfx.length).split('/')[0] + '/')
          .filter((v, i, a) => a.indexOf(v) === i)
        const objs = MOCK_OBJECTS.filter((o) => o.key.startsWith(pfx) && !o.key.slice(pfx.length).includes('/'))
        set({ directories: dirs, objects: objs, usage: { objects: MOCK_OBJECTS.length, bytes: MOCK_OBJECTS.reduce((sum, obj) => sum + obj.size, 0) }, loading: false })
        return
      }
      try {
        const data = await config.api.get(`channels/${channelId}/storage`, { searchParams: prefix ? { prefix } : {} }).json<{ objects: StorageObject[]; common_prefixes: string[]; policy?: StoragePolicy; usage?: StorageUsage; capabilities?: { can_upload?: boolean } }>()
        set({ objects: data.objects || [], directories: data.common_prefixes || [], policy: data.policy || get().policy, usage: data.usage || get().usage, canUpload: data.capabilities?.can_upload ?? get().canUpload, loading: false })
      } catch { set({ loading: false }) }
    },

    uploadFile: async (channelId, file, prefix = get().currentPrefix) => {
      const visiblePrefix = get().currentPrefix
      const contentType = contentTypeForUpload(file)
      set({ uploading: true, uploadProgress: 0, uploadError: null })
      if (config.useMock) {
        const key = `${prefix || ''}${file.name}`
        const obj: StorageObject = { key, name: file.name, display_name: file.name, size: file.size, content_type: contentType, last_modified: new Date().toISOString(), status: 'available' }
        if (prefix === visiblePrefix) set({ objects: [obj, ...get().objects] })
        set({ uploading: false, uploadProgress: 100 })
        return obj
      }
      try {
        const presign = await config.api.post(`channels/${channelId}/storage/presign-upload`, {
          json: { file_name: file.name, content_type: contentType, size: file.size, prefix },
        }).json<{ object: StorageObject; upload_url: string; method: string; headers?: Record<string, string> }>()

        const headers = presign.headers && Object.keys(presign.headers).length > 0 ? presign.headers : undefined
        const uploadBody = await file.arrayBuffer()
        await uploadWithProgress(presign.upload_url, presign.method || 'PUT', uploadBody, headers, (progress) => {
          set({ uploadProgress: progress })
        })

        const completed = await config.api.post(`channels/${channelId}/storage/complete-upload`, {
          json: { object_id: presign.object.id },
        }).json<StorageObject>()
        set({ uploadProgress: 100 })
        await get().browse(channelId, visiblePrefix)
        return completed
      } catch (err) {
        const message = err instanceof Error ? err.message : '上传失败'
        set({ uploadError: message })
        throw err
      } finally {
        set({ uploading: false })
      }
    },

    createDirectory: async (channelId, name, prefix = get().currentPrefix) => {
      const safeName = name.trim()
      if (!safeName) return
      if (config.useMock) {
        const dir = `${prefix || ''}${safeName.replaceAll('/', '_')}/`
        set({ directories: [...get().directories, dir].filter((v, i, a) => a.indexOf(v) === i) })
        return
      }
      await config.api.post(`channels/${channelId}/storage/directory`, {
        json: { name: safeName, prefix },
      })
      await get().browse(channelId, prefix)
    },

    downloadFile: async (channelId, key) => {
      if (config.useMock) return null
      const data = await config.api.post(`channels/${channelId}/storage/presign-download`, {
        json: { key },
      }).json<{ url: string }>()
      return data.url
    },

    deleteFile: async (channelId, key) => {
      if (config.useMock) { set({ objects: get().objects.filter((o) => o.key !== key) }); return }
      try {
        await config.api.delete(`channels/${channelId}/storage/file/${encodeURIComponent(key)}`)
        set({ objects: get().objects.filter((o) => o.key !== key) })
      } catch { /* */ }
    },

    clearUploadError: () => set({ uploadError: null }),
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

    reset: () => set({ objects: [], directories: [], currentPrefix: '', loading: false, uploading: false, uploadProgress: 0, uploadError: null, policy: { enabled: true, visibility: 'channel', members_can_upload: true, members_can_delete_own: true }, usage: { objects: 0, bytes: 0 }, canUpload: true, searchQuery: '', previewObj: null }),
  }))
}

export type StorageStore = ReturnType<typeof createStorageStore>

function uploadWithProgress(
  url: string,
  method: string,
  body: Blob | ArrayBuffer,
  headers: Record<string, string> | undefined,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value))
    }
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error(`上传失败：HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('上传失败：网络或跨域请求被拒绝'))
    xhr.onabort = () => reject(new Error('上传已取消'))
    xhr.send(body)
  })
}

function contentTypeForUpload(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  switch (ext) {
  case 'jpg':
  case 'jpeg':
    return 'image/jpeg'
  case 'png':
    return 'image/png'
  case 'webp':
    return 'image/webp'
  case 'gif':
    return 'image/gif'
  case 'svg':
    return 'image/svg+xml'
  case 'pdf':
    return 'application/pdf'
  case 'txt':
    return 'text/plain'
  case 'md':
  case 'markdown':
    return 'text/markdown'
  case 'json':
    return 'application/json'
  default:
    return 'application/octet-stream'
  }
}
