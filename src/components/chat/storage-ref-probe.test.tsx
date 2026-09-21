// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { ApiError } from '../../core/errors.js'
import { useExistingStorageRefs } from './StorageAttachmentPreview.js'

const { post, context } = vi.hoisted(() => {
  const post = vi.fn()
  return { post, context: { api: { post }, config: { useMockData: false } } }
})
vi.mock('../../provider/BeeSeedProvider.js', () => ({ useBeeSeedContext: () => context }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

it('相同引用的新数组与探测失败的状态更新不会再次发送请求', async () => {
  post.mockReturnValue({ json: () => Promise.reject(new ApiError('rate limited', 429)) })
  function Probe({ tick }: { tick: number }) {
    const { existingRefs } = useExistingStorageRefs('probe-regression', ['storage://test.txt'])
    return <span>{tick}:{existingRefs.length}</span>
  }
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    await act(() => root.render(<Probe tick={0} />))
    await act(() => root.render(<Probe tick={1} />))
    await act(() => root.render(<Probe tick={2} />))
    expect(post).toHaveBeenCalledTimes(1)
    expect(host.textContent).toBe('2:0')
  } finally {
    await act(() => root.unmount())
  }
})
