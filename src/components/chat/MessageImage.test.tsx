// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageImage } from './MessageImage.js'

const mocks = vi.hoisted(() => {
  const post = vi.fn()
  return {
    post,
    context: { api: { post }, config: { useMockData: false } },
  }
})
vi.mock('../../provider/BeeSeedProvider.js', () => ({
  useOptionalBeeSeedContext: () => mocks.context,
}))

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root | undefined
let host: HTMLDivElement

beforeEach(() => {
  mocks.post.mockReset()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  if (root) await act(() => root?.unmount())
  host.remove()
})

describe('MessageImage', () => {
  it('refreshes an expired image through its stable storage reference', async () => {
    mocks.post.mockReturnValue({ json: () => Promise.resolve({ url: 'https://objects.example/fresh.png' }) })

    await act(async () => {
      root!.render(
        <MessageImage
          channelId="channel-a"
          src="https://objects.example/expired.png?Signature=expired"
          storageRef="storage://platform/fal/orgs/org-a/jobs/38/fal_1.png"
          alt="耳穴国标定位海报"
        />,
      )
    })

    expect(mocks.post).toHaveBeenCalledWith('channels/channel-a/storage/presign-download', {
      json: {
        key: 'platform/fal/orgs/org-a/jobs/38/fal_1.png',
        disposition: 'inline',
      },
    })
    const image = host.querySelector('img')
    expect(image?.src).toBe('https://objects.example/fresh.png')
    expect(image?.alt).toBe('耳穴国标定位海报')
  })

  it('shows an accessible retry state instead of a broken image', async () => {
    mocks.post.mockReturnValue({ json: () => Promise.reject(new Error('not found')) })

    await act(async () => {
      root!.render(
        <MessageImage
          channelId="channel-a"
          src="https://objects.example/expired.png?Signature=expired"
          storageRef="storage://platform/fal/missing.png"
          alt="耳穴"
        />,
      )
    })

    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('耳穴加载失败')
    const retry = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('重新加载'))
    expect(retry).toBeTruthy()
    await act(() => retry!.click())
    expect(mocks.post).toHaveBeenCalledTimes(2)
  })
})
