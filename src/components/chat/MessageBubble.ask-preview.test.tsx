// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../../core/types.js'
import { MessageBubble } from './MessageBubble.js'

const probe = vi.hoisted(() => vi.fn())
vi.mock('./StorageAttachmentPreview.js', () => ({
  StorageAttachmentPreview: () => null,
  useExistingStorageRefs: (channel: string, refs: string[]) => {
    probe(channel, refs)
    const existingRefs = refs.filter(ref => !ref.includes('missing'))
    return { existingRefs, isExistingRef: (ref: string) => existingRefs.includes(ref) }
  },
  StoragePreviewDialog: ({ channelId, refText, onClose }: { channelId: string; refText: string; onClose: () => void }) => (
    <div role="dialog" data-channel={channelId} data-ref={refText}><button onClick={onClose}>关闭预览</button></div>
  ),
}))

let root: Root | undefined
let host: HTMLDivElement
afterEach(async () => {
  if (root) await act(() => root?.unmount())
  host?.remove()
  vi.clearAllMocks()
})

describe('确认题卡文件预览', () => {
  it('标题和正文引用打开当前频道预览，缺失文件不生成按钮，关闭不提交回答', async () => {
    const onSubmitAnswer = vi.fn()
    const message = {
      role: 'assistant', content: '', timestamp: Date.now(), isAgent: true,
      askUserData: { status: 'pending', askId: 'ask-a', targetUserId: 'user-a', questions: [{
        id: 'confirm', type: 'single_select', title: '确认 `storage://draft/deck.pptx`',
        description: '预览 storage://draft/document.pdf（文件保持原样，不会修改）和 `storage://draft/missing.pdf`',
        options: [{ id: 'yes', label: '确认' }],
      }] },
    } as ChatMessage
    host = document.createElement('div'); document.body.appendChild(host)
    root = createRoot(host)
    await act(() => root!.render(<MessageBubble message={message} channelId="channel-a" currentUserId="user-a" isOwn={false} onSubmitAnswer={onSubmitAnswer} />))
    expect(probe).toHaveBeenCalledWith('channel-a', expect.arrayContaining(['storage://draft/deck.pptx', 'storage://draft/document.pdf', 'storage://draft/missing.pdf']))
    for (const name of ['deck.pptx', 'document.pdf']) {
      const button = [...host.querySelectorAll('button')].find(b => b.textContent === name)
      expect(button).toBeTruthy()
      await act(() => button!.click())
      const dialog = host.querySelector('[role="dialog"]')!
      expect(dialog.getAttribute('data-channel')).toBe('channel-a')
      expect(dialog.getAttribute('data-ref')).toBe(`storage://draft/${name}`)
      await act(() => (dialog.querySelector('button') as HTMLButtonElement).click())
      expect(host.querySelector('[role="dialog"]')).toBeNull()
      expect(host.textContent).toContain('请回答')
    }
    expect([...host.querySelectorAll('button')].some(b => b.textContent?.includes('missing.pdf'))).toBe(false)
    expect(onSubmitAnswer).not.toHaveBeenCalled()
  })
})
