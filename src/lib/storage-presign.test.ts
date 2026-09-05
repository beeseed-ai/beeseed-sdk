import { describe, expect, it } from 'vitest'
import { storageAttachmentDownloadPayload, storagePresignDownloadPayload, storagePreviewPresignPayload } from './storage-presign.js'

describe('storage presign payloads', () => {
  it('binds artifact preview and download requests to the exact object id', () => {
    expect(storagePreviewPresignPayload('storage://workspace/artifacts/report.pdf', 'object-v1')).toEqual({
      key: 'workspace/artifacts/report.pdf',
      object_id: 'object-v1',
      disposition: 'inline',
    })
    expect(storageAttachmentDownloadPayload('workspace/artifacts/report.pdf', 'object-v1')).toEqual({
      key: 'workspace/artifacts/report.pdf',
      object_id: 'object-v1',
      disposition: 'attachment',
    })
  })

  it('keeps path-only requests backward compatible when object id is absent', () => {
    expect(storagePresignDownloadPayload('workspace/artifacts/report.pdf')).toEqual({
      key: 'workspace/artifacts/report.pdf',
    })
  })
})
