import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useStorage(channelId: string | null) {
  const { storageStore } = useBeeSeedContext()
  const state = useStore(storageStore)

  useEffect(() => {
    if (!channelId) return
    void state.browse(channelId, '')
  }, [channelId])

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
