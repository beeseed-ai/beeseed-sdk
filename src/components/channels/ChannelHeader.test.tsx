// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChannelHeader } from './ChannelHeader.js'

describe('ChannelHeader channel ID copy', () => {
  let host: HTMLDivElement
  let root: Root
  const writeText = vi.fn(async () => undefined)

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
    vi.restoreAllMocks()
  })

  it('exposes and copies the exact channel ID with success feedback', async () => {
    await act(async () => root.render(<ChannelHeader channel={{ id: 'channel-123', name: '测试频道', member_count: 2 } as never} />))
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="复制频道 ID"]')
    expect(button?.dataset.beeseedChannelId).toBe('channel-123')
    expect(button?.title).toBe('复制频道 ID')

    await act(async () => button?.click())
    expect(writeText).toHaveBeenCalledWith('channel-123')
    expect(button?.title).toBe('频道 ID 已复制')
  })
})
