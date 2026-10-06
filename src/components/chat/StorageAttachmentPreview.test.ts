import { describe, expect, it, vi } from 'vitest'
import { openStorageDownload, probeStorageRefExistence, requestStoragePreviewURL, storageFileCanPreview, storageFileKindForRef } from './StorageAttachmentPreview.js'
import { ApiError } from '../../core/errors.js'

describe('presentation preview signing', () => {
  it('requests a short preview address bound to the exact long-name object for Office', async () => {
    const post = vi.fn(() => ({ json: async () => ({ url: 'https://storage.example/signed-object' }) }))
    const api = { post } as unknown as Parameters<typeof requestStoragePreviewURL>[0]
    const key = `folder/${'中文演示文稿'.repeat(15)}.pptx`

    await requestStoragePreviewURL(api, 'channel-a', `storage://${key}`, 'presentation', 'exact-object')

    expect(post).toHaveBeenCalledWith('channels/channel-a/storage/presentation-preview', {
      json: { key, object_id: 'exact-object' },
    })
  })

  it('preserves the PDF preview endpoint and its version binding', async () => {
    const post = vi.fn(() => ({ json: async () => ({ url: 'https://storage.example/signed-object' }) }))
    const api = { post } as unknown as Parameters<typeof requestStoragePreviewURL>[0]

    await requestStoragePreviewURL(api, 'channel-a', 'storage://folder/report.pdf', 'pdf', 'pdf-v2')

    expect(post).toHaveBeenCalledWith('channels/channel-a/storage/pdf-preview', {
      json: { key: 'folder/report.pdf', object_id: 'pdf-v2' },
    })
  })

  for (const [fileName, kind] of [
    ['项目周报.docx', 'document'],
    ['月度预算.xlsx', 'spreadsheet'],
  ] as const) it(`requests an exact-object Office preview for ${fileName}`, async () => {
    const post = vi.fn(() => ({ json: async () => ({ url: 'https://worker.example/api/storage-preview/token/file' }) }))
    const api = { post } as unknown as Parameters<typeof requestStoragePreviewURL>[0]

    expect(storageFileKindForRef(`storage://reports/${fileName}`)).toBe(kind)
    expect(storageFileCanPreview(kind, fileName.endsWith('.docx') ? 'docx' : 'xlsx')).toBe(true)
    await requestStoragePreviewURL(api, 'channel-a', `storage://reports/${fileName}`, kind, 'exact-object')

    expect(post).toHaveBeenCalledWith('channels/channel-a/storage/presentation-preview', {
      json: { key: `reports/${fileName}`, object_id: 'exact-object' },
    })
  })

  it('does not advertise Apple Numbers as an Office online preview', () => {
    expect(storageFileKindForRef('storage://reports/budget.numbers')).toBe('spreadsheet')
    expect(storageFileCanPreview('spreadsheet', 'numbers')).toBe(false)
  })
})

describe('openStorageDownload', () => {
  it('hands the real attachment URL to the browser and keeps the retry URL', async () => {
    const requestURL = vi.fn().mockResolvedValue('https://storage.example/file')
    const launchDownload = vi.fn()

    await expect(openStorageDownload(requestURL, '中医科普.pptx', launchDownload)).resolves.toBe('https://storage.example/file')

    expect(launchDownload).toHaveBeenCalledWith('https://storage.example/file', '中医科普.pptx')
  })

  it('rejects an empty attachment URL before opening a new tab', async () => {
    const launchDownload = vi.fn()
    await expect(openStorageDownload(
      () => Promise.resolve(''),
      '中医科普.pptx',
      launchDownload,
    )).rejects.toThrow('下载链接为空')
    expect(launchDownload).not.toHaveBeenCalled()
  })
})

describe('probeStorageRefExistence', () => {
  for (const status of [401, 403, 404, 429]) it(`does not amplify SDK HTTP ${status} failures`, async () => {
    const check = vi.fn().mockRejectedValue(new ApiError('request failed', status))
    const wait = vi.fn()
    await expect(probeStorageRefExistence(check, wait)).resolves.toBe(false)
    expect(check).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  })

  it('does not list storage or re-sign on a throttled preview', async () => {
    const error = new ApiError('rate limited', 429)
    const post = vi.fn(() => ({ json: () => Promise.reject(error) }))
    const get = vi.fn()
    const api = { post, get } as unknown as Parameters<typeof requestStoragePreviewURL>[0]
    await expect(requestStoragePreviewURL(api, 'channel-a', 'storage://report.pptx', 'presentation')).rejects.toBe(error)
    expect(post).toHaveBeenCalledOnce()
    expect(get).not.toHaveBeenCalled()
  })
  it('retries a transient server race until the file becomes visible', async () => {
    const check = vi.fn()
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValue({ url: 'https://storage.example/file' })
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(probeStorageRefExistence(check, wait)).resolves.toBe(true)
    expect(check).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledOnce()
    expect(wait).toHaveBeenCalledWith(250)
  })

  it('does not retry a permanent missing-file response', async () => {
    const check = vi.fn().mockRejectedValue({ response: { status: 404 } })
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(probeStorageRefExistence(check, wait)).resolves.toBe(false)
    expect(check).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  })
})
