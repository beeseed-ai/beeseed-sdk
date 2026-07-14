import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

const STORAGE_MUTATION_EVENT = 'beeseed:storage-mutated'

export function useStorage(channelId: string | null) {
  const { storageStore } = useBeeSeedContext()
  const state = useStore(storageStore)

  useEffect(() => {
    if (!channelId) return
    void storageStore.getState().browse(channelId, '')
  }, [channelId, storageStore])

  useEffect(() => {
    if (!channelId || typeof window === 'undefined') return

    let refreshTimer: number | undefined
    const handleStorageMutation = (event: Event) => {
      const detail = (event as CustomEvent<{ channelId?: string }>).detail
      if (detail?.channelId && detail.channelId !== channelId) return

      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        const latest = storageStore.getState()
        void latest.browse(channelId, latest.currentPrefix)
      }, 120)
    }

    window.addEventListener(STORAGE_MUTATION_EVENT, handleStorageMutation)
    return () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      window.removeEventListener(STORAGE_MUTATION_EVENT, handleStorageMutation)
    }
  }, [channelId, storageStore])

  return {
    objects: state.filteredObjects(),
    directories: state.directories,
    currentPrefix: state.currentPrefix,
    loading: state.loading,
    uploading: state.uploading,
    uploadProgress: state.uploadProgress,
    uploadError: state.uploadError,
    policy: state.policy,
    usage: state.usage,
    canUpload: state.canUpload,
    searchQuery: state.searchQuery,
    previewObj: state.previewObj,
    breadcrumbs: state.breadcrumbs(),
    browse: (prefix: string) => channelId ? state.browse(channelId, prefix) : Promise.resolve(),
    createDirectory: (name: string, prefix?: string) => channelId ? state.createDirectory(channelId, name, prefix) : Promise.resolve(),
    uploadFile: (file: File, prefix?: string) => channelId ? state.uploadFile(channelId, file, prefix) : Promise.resolve(null),
    downloadFile: (key: string) => channelId ? state.downloadFile(channelId, key) : Promise.resolve(null),
    deleteFile: (key: string) => channelId ? state.deleteFile(channelId, key) : Promise.resolve(),
    clearUploadError: state.clearUploadError,
    setSearchQuery: state.setSearchQuery,
    setPreviewObj: state.setPreviewObj,
  }
}
