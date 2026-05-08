import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useConnection() {
  const { connectionStore } = useBeeSeedContext()
  return useStore(connectionStore)
}
