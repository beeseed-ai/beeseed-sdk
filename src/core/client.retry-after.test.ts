import { afterEach, expect, it, vi } from 'vitest'
import { createApiClient } from './client.js'
import { ApiError } from './errors.js'

afterEach(() => vi.unstubAllGlobals())
it.each([
  ['12', 12000], ['0', 0], ['nonsense', undefined], ['', undefined],
])('保留 Retry-After=%s 且不自行重试', async (header, expected) => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"error":"rate limited","code":"RATE_LIMITED"}', {
    status: 429, headers: { 'Retry-After': header, 'Content-Type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetch)
  const api = createApiClient({ workerUrl: 'https://example.invalid', getToken: () => null })
  const error = await api.post('storage').json().catch(error => error)
  expect(error).toBeInstanceOf(ApiError)
  if (!(error instanceof ApiError)) throw new Error('Expected ApiError')
  expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED' })
  expect(error.retryAfterMs).toBe(expected)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('支持 HTTP 日期形式的 Retry-After', async () => {
  const now = Date.now()
  const deadline = new Date(now + 12000).toUTCString()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': deadline } })))
  const api = createApiClient({ workerUrl: 'https://example.invalid', getToken: () => null })
  const error = await api.post('storage').json().catch(error => error)
  if (!(error instanceof ApiError)) throw new Error('Expected ApiError')
  expect(error.retryAfterMs).toBeGreaterThan(10000)
  expect(error.retryAfterMs).toBeLessThanOrEqual(12000)
})
