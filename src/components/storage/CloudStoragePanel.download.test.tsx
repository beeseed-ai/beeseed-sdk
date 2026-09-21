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
