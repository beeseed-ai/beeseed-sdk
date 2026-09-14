import { describe, expect, it, vi } from 'vitest'
import { openStorageDownload, probeStorageRefExistence, requestStoragePreviewURL } from './StorageAttachmentPreview.js'

describe('presentation preview signing', () => {
  it('keeps the exact long-name object without adding a filename disposition for Office', async () => {
    const post = vi.fn(() => ({ json: async () => ({ url: 'https://storage.example/signed-object' }) }))
    const api = { post } as unknown as Parameters<typeof requestStoragePreviewURL>[0]
    const key = `folder/${'中文演示文稿'.repeat(15)}.pptx`

    await requestStoragePreviewURL(api, 'channel-a', `storage://${key}`, 'presentation', 'exact-object')

    expect(post).toHaveBeenCalledWith('channels/channel-a/storage/presign-download', {
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
})

describe('openStorageDownload', () => {
  it('opens a tab before waiting for the presigned URL', async () => {
    let resolveURL!: (url: string) => void
    const requestURL = vi.fn(() => new Promise<string>((resolve) => { resolveURL = resolve }))
    const target = {
      opener: {} as Window | null,
      location: { replace: vi.fn() },
      close: vi.fn(),
    }
    const openWindow = vi.fn(() => target as unknown as Window)

    const pending = openStorageDownload(requestURL, openWindow as typeof window.open)

    expect(openWindow).toHaveBeenCalledWith('about:blank', '_blank')
    expect(requestURL).toHaveBeenCalledOnce()
    expect(target.opener).toBeNull()
    expect(target.location.replace).not.toHaveBeenCalled()

    resolveURL('https://storage.example/file')
    await pending

    expect(target.location.replace).toHaveBeenCalledWith('https://storage.example/file')
    expect(target.close).not.toHaveBeenCalled()
  })

  it('closes the pre-opened tab when URL creation fails', async () => {
    const target = {
      opener: {} as Window | null,
      location: { replace: vi.fn() },
      close: vi.fn(),
    }
    const openWindow = vi.fn(() => target as unknown as Window)

    await expect(openStorageDownload(
      () => Promise.reject(new Error('presign failed')),
      openWindow as typeof window.open,
    )).rejects.toThrow('presign failed')

    expect(target.close).toHaveBeenCalledOnce()
    expect(target.location.replace).not.toHaveBeenCalled()
  })
})

describe('probeStorageRefExistence', () => {
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
