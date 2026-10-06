// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { CloudStoragePanel } from './CloudStoragePanel.js'

const { download, downloadFile } = vi.hoisted(() => ({ download: vi.fn(), downloadFile: vi.fn() }))
vi.mock('../chat/StorageAttachmentPreview.js', () => ({
  openStorageDownload: download, StorageFileIcon: () => null, StoragePreviewDialog: () => null,
  storageFileLabelForRef: () => 'TXT',
}))
vi.mock('../../hooks/use-detail-panel.js', () => ({ useDetailPanel: () => ({}) }))
vi.mock('../../hooks/use-storage.js', () => ({ useStorage: () => ({
  objects: [{ key: 'report.txt', name: 'report.txt', size: 12 }], directories: [],
  currentPrefix: '', policy: { visibility: 'shared' }, usage: { bytes: 12 }, breadcrumbs: [],
  searchQuery: '', downloadFile,
}) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

it('下载期间禁止重复点击，失败后恢复按钮并显示错误', async () => {
  let rejectDownload!: (error: Error) => void
  download.mockImplementation(() => new Promise((_resolve, reject) => { rejectDownload = reject }))
  const host = document.createElement('div'), root = createRoot(host)
  try {
    await act(() => root.render(<CloudStoragePanel channelId="download-test" />))
    const button = host.querySelector<HTMLButtonElement>('[data-testid="storage-file-download"]')!
    await act(() => { button.click(); button.click() })
    expect(download).toHaveBeenCalledTimes(1)
    expect(download).toHaveBeenCalledWith(expect.any(Function), 'report.txt')
    expect(button.disabled).toBe(true)
    await act(() => rejectDownload(new Error('rate limited')))
    expect(button.disabled).toBe(false)
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('文件下载失败')
  } finally { await act(() => root.unmount()) }
})

it('下载发起后保留用户手势重试和临时链接复制入口', async () => {
  download.mockResolvedValue('https://worker.example/api/storage-preview/token/report.txt')
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const host = document.createElement('div'), root = createRoot(host)
  try {
    await act(() => root.render(<CloudStoragePanel channelId="download-test" />))
    await act(async () => { host.querySelector<HTMLButtonElement>('[data-testid="storage-file-download"]')!.click() })
    const fallback = host.querySelector<HTMLAnchorElement>('a[href="https://worker.example/api/storage-preview/token/report.txt"]')
    expect(fallback?.textContent).toContain('再次下载')
    expect(fallback?.download).toBe('report.txt')
    await act(async () => { [...host.querySelectorAll('button')].find((button) => button.textContent === '复制临时下载链接')?.click() })
    expect(writeText).toHaveBeenCalledWith('https://worker.example/api/storage-preview/token/report.txt')
    expect(host.textContent).toContain('已复制')
  } finally { await act(() => root.unmount()) }
})
