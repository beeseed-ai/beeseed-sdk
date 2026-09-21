import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../core/errors.js'

/** 只约束用户重试，不自动重复请求。 */
export function useRetryAfter() {
  const until = useRef(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const handleRateLimit = useCallback((error: unknown) => {
    if (!(error instanceof ApiError) || error.status !== 429) return false
    const delay = error.retryAfterMs
    if (delay !== undefined && Number.isFinite(delay) && delay > 0) {
      until.current = Math.max(until.current, Date.now() + delay)
      setRemainingSeconds(Math.ceil((until.current - Date.now()) / 1000))
    }
    return true
  }, [])
  useEffect(() => {
    if (!remainingSeconds) return
    const timer = window.setInterval(() => setRemainingSeconds(Math.max(0, Math.ceil((until.current - Date.now()) / 1000))), 250)
    return () => window.clearInterval(timer)
  }, [remainingSeconds > 0])
  return { remainingSeconds, handleRateLimit, isCoolingDown: () => Date.now() < until.current }
}
