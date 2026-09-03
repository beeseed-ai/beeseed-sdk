import { describe, expect, it, vi } from 'vitest'
import { probeStorageRefExistence } from './StorageAttachmentPreview.js'

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
