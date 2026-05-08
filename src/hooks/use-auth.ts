import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useAuth() {
  const { authStore } = useBeeSeedContext()
  return useStore(authStore)
}
