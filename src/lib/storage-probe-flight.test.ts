import { expect, it, vi } from 'vitest'
import { shareStorageProbe } from './storage-probe-flight.js'

it('同一 API、身份和文件只共享进行中的探测，结束后重新检查', async () => {
  const api = {}, check = vi.fn().mockResolvedValue(true)
  const first = shareStorageProbe(api, 'test-session', 'channel/file', check)
  expect(shareStorageProbe(api, 'test-session', 'channel/file', check)).toBe(first)
  await first
  expect(check).toHaveBeenCalledTimes(1)
  await shareStorageProbe(api, 'test-session', 'channel/file', check)
  expect(check).toHaveBeenCalledTimes(2)
})
it('不跨身份、App API 实例或频道合并请求', async () => {
  const api = {}, check = vi.fn().mockResolvedValue(false)
  const requests = [shareStorageProbe(api, 'a', 'channel/file', check),
    shareStorageProbe(api, 'b', 'channel/file', check),
    shareStorageProbe({}, 'b', 'channel/file', check),
    shareStorageProbe(api, 'b', 'other/file', check)]
  await Promise.all(requests)
  expect(check).toHaveBeenCalledTimes(4)
})
it('拒绝的请求不留在进行中缓存', async () => {
  const api = {}, check = vi.fn().mockRejectedValue(new Error('failed'))
  await expect(shareStorageProbe(api, null, 'file', check)).rejects.toThrow('failed')
  await expect(shareStorageProbe(api, null, 'file', check)).rejects.toThrow('failed')
  expect(check).toHaveBeenCalledTimes(2)
})
