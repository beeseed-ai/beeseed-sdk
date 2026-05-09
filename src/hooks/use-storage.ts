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
    searchQuery: state.searchQuery,
    previewObj: state.previewObj,
    breadcrumbs: state.breadcrumbs(),
    browse: (prefix: string) => roomId ? state.browse(roomId, prefix) : Promise.resolve(),
    deleteFile: (key: string) => roomId ? state.deleteFile(roomId, key) : Promise.resolve(),
    setSearchQuery: state.setSearchQuery,
    setPreviewObj: state.setPreviewObj,
  }
}
