import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/use-auth.js'

interface Props {
  children: ReactNode
  fallback: ReactNode
  loading?: ReactNode
}

export function AuthGuard({ children, fallback, loading: loadingNode }: Props) {
  const { user, loading } = useAuth()

  if (loading) {
    return loadingNode ?? (
      <div className="flex h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground animate-pulse">加载中...</span>
      </div>
    )
  }

  if (!user) return <>{fallback}</>

  return <>{children}</>
}
