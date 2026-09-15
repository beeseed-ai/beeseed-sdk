// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createStore } from 'zustand/vanilla'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageInput } from './MessageInput.js'

const mocks = vi.hoisted(() => ({ upload: vi.fn(), send: vi.fn(), consumed: vi.fn() }))
const workflowsStore = createStore(() => ({ workflows: [], loading: false, fetchWorkflows: vi.fn() }))
vi.mock('../../hooks/use-auth.js', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }))
vi.mock('../../hooks/use-detail-panel.js', () => ({ useDetailPanel: () => ({}) }))
vi.mock('../../provider/BeeSeedProvider.js', () => ({ useBeeSeedContext: () => ({ workflowsStore }) }))
vi.mock('../../hooks/use-storage.js', () => ({ useStorage: () => ({ uploadFile: mocks.upload, uploading: false, uploadProgress: 0 }) }))
vi.mock('./StorageAttachmentPreview.js', () => ({ StorageFileIcon: () => null, storageFileLabelForRef: () => 'TXT' }))
let host: HTMLDivElement, root: Root
const render = async (channelId: string, insertText: string | null = null) => {
  await act(async () => root.render(<MessageInput channelId={channelId} insertText={insertText}
    onSend={mocks.send} onInsertTextConsumed={mocks.consumed} />))
}
const send = async () => {
  host.querySelector('textarea')!.value = '仅发送本频道消息'
  await act(async () => host.querySelector<HTMLButtonElement>('button[title="发送"]')!.click())
}
const upload = async () => {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['a'], 'a.txt')] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks(); host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('聊天文件引用的频道隔离', () => {
  it('引用在同频道发送正常，跨频道后不显示也不发送旧引用', async () => {
    await render('a', 'storage://same-channel.txt'); await render('a'); await send()
    expect(mocks.send.mock.calls[0][0]).toContain('storage://same-channel.txt')
    await render('a', 'storage://old-channel.txt'); await render('a'); await render('b')
    expect(host.querySelector('[aria-label="移除引用文件"]')).toBeNull()
    await send(); expect(mocks.send.mock.calls[1][0]).toBe('仅发送本频道消息')
  })
  it('A 上传完成前切换 B 再回 A，旧上传不会重新加入引用', async () => {
    let finish!: (value: { key: string }) => void
    mocks.upload.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await render('a'); await upload(); await render('b'); await render('a')
    await act(async () => finish({ key: 'late-a.txt' }))
    expect(host.querySelector('[aria-label="移除引用文件"]')).toBeNull()
    await send(); expect(mocks.send.mock.calls[0][0]).toBe('仅发送本频道消息')
  })
  it('旧频道上传失败不会显示到新频道，当前频道上传仍可发送', async () => {
    let fail!: (error: Error) => void
    mocks.upload.mockReturnValueOnce(new Promise((_, reject) => { fail = reject }))
    await render('a'); await upload(); await render('b')
    await act(async () => fail(new Error('old-channel-error')))
    expect(host.textContent).not.toContain('old-channel-error')
    mocks.upload.mockResolvedValueOnce({ key: 'new-b.txt' }); await upload(); await send()
    expect(mocks.send.mock.calls[0][0]).toContain('storage://new-b.txt')
  })
})
