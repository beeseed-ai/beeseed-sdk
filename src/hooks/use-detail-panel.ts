import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useDetailPanel() {
  const { detailPanelStore } = useBeeSeedContext()
  return useStore(detailPanelStore)
}
