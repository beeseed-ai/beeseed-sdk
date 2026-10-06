// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { StorageAttachmentPreview } from './StorageAttachmentPreview.js'

vi.mock('../../provider/BeeSeedProvider.js', () => {
  const context = { api: {}, config: { useMockData: true } }
  return { useBeeSeedContext: () => context }
})

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const hosts: HTMLDivElement[] = []
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove()
})

it('历史消息的普通文件和图片都提供可聚焦的引用入口', async () => {
  const host = document.createElement('div')
  hosts.push(host)
  document.body.appendChild(host)
  const root = createRoot(host)
  const onReference = vi.fn()
  const refs = ['storage://reports/项目报告.pdf', 'storage://images/现场照片.png'].map(encodeURI)

  try {
    await act(async () => {
      root.render(<StorageAttachmentPreview channelId="channel-a" refs={refs} onReference={onReference} />)
    })

    const fileButton = host.querySelector<HTMLButtonElement>('[aria-label="引用文件到聊天：storage://reports/项目报告.pdf"]')
    const imageButton = host.querySelector<HTMLButtonElement>('[aria-label="引用文件到聊天：storage://images/现场照片.png"]')
    expect(fileButton).not.toBeNull()
    expect(imageButton).not.toBeNull()
    expect(fileButton?.className).toContain('md:opacity-0')
    expect(fileButton?.className).toContain('md:group-hover/storage-file:opacity-100')

    await act(() => fileButton!.click())
    await act(() => imageButton!.click())
    expect(onReference).toHaveBeenNthCalledWith(1, refs[0])
    expect(onReference).toHaveBeenNthCalledWith(2, refs[1])
  } finally {
    await act(() => root.unmount())
  }
})
