import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

const STORAGE_MUTATION_EVENT = 'beeseed:storage-mutated'

export function useStorage(channelId: string | null) {
  const { storageStore } = useBeeSeedContext()
  const state = useStore(storageStore)
  const matchesChannel = Boolean(channelId) && state.channelId === channelId

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
    objects: matchesChannel ? state.filteredObjects() : [],
    directories: matchesChannel ? state.directories : [],
    currentPrefix: matchesChannel ? state.currentPrefix : '',
    loading: Boolean(channelId) && (!matchesChannel || state.loading),
    uploading: matchesChannel && state.uploading,
    uploadProgress: matchesChannel ? state.uploadProgress : 0,
    uploadError: matchesChannel ? state.uploadError : null,
    error: matchesChannel ? state.error : null,
    notice: matchesChannel ? state.notice : null,
    clearError: state.clearError,
    policy: state.policy,
    usage: matchesChannel ? state.usage : { objects: 0, bytes: 0 },
    canUpload: matchesChannel && state.canUpload,
    searchQuery: matchesChannel ? state.searchQuery : '',
    previewObj: matchesChannel ? state.previewObj : null,
    breadcrumbs: matchesChannel ? state.breadcrumbs() : [{ label: '根目录', prefix: '' }],
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
