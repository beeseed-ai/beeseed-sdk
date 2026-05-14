import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useStorage(roomId: string | null) {
  const { storageStore } = useBeeSeedContext()
  const state = useStore(storageStore)

  useEffect(() => {
    if (!roomId) return
    void state.browse(roomId, '')
  }, [roomId])

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
    browse: (prefix: string) => roomId ? state.browse(roomId, prefix) : Promise.resolve(),
    createDirectory: (name: string, prefix?: string) => roomId ? state.createDirectory(roomId, name, prefix) : Promise.resolve(),
    uploadFile: (file: File, prefix?: string) => roomId ? state.uploadFile(roomId, file, prefix) : Promise.resolve(null),
    downloadFile: (key: string) => roomId ? state.downloadFile(roomId, key) : Promise.resolve(null),
    deleteFile: (key: string) => roomId ? state.deleteFile(roomId, key) : Promise.resolve(),
    clearUploadError: state.clearUploadError,
    setSearchQuery: state.setSearchQuery,
    setPreviewObj: state.setPreviewObj,
  }
}
