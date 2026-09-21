// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { ApiError } from '../core/errors.js'
import { useRetryAfter } from './use-retry-after.js'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
it('429 按服务端时长倒计时，不自动发出请求，到期恢复', async () => {
  vi.useFakeTimers()
  const host = document.createElement('div'), root = createRoot(host)
  let hook!: ReturnType<typeof useRetryAfter>
  function Harness() { hook = useRetryAfter(); return <span>{hook.remainingSeconds}</span> }
  try {
    await act(() => root.render(<Harness />))
    const error = new ApiError('rate limited', 429)
    error.retryAfterMs = 2100
    await act(() => { expect(hook.handleRateLimit(error)).toBe(true) })
    expect(host.textContent).toBe('3')
    expect(hook.isCoolingDown()).toBe(true)
    await act(() => vi.advanceTimersByTime(1250))
    expect(host.textContent).toBe('1')
    await act(() => vi.advanceTimersByTime(1000))
    expect(host.textContent).toBe('0')
    expect(hook.isCoolingDown()).toBe(false)
    expect(hook.handleRateLimit(new ApiError('forbidden', 403))).toBe(false)
    await act(() => { hook.handleRateLimit(new ApiError('no header', 429)) })
    expect(hook.isCoolingDown()).toBe(false)
  } finally { await act(() => root.unmount()); vi.useRealTimers() }
})
