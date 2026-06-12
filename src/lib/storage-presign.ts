import { keyFromStorageRef } from './storage-ref.js'

export type StorageDownloadDisposition = 'inline' | 'attachment'

export interface StoragePresignDownloadPayload {
  key: string
  process?: string
  disposition?: StorageDownloadDisposition
}

export function storagePresignDownloadPayload(
  key: string,
  options: { process?: string; disposition?: StorageDownloadDisposition } = {},
): StoragePresignDownloadPayload {
  const payload: StoragePresignDownloadPayload = { key }
  if (options.process) payload.process = options.process
  if (options.disposition) payload.disposition = options.disposition
  return payload
}

export function storagePreviewPresignPayload(refText: string): StoragePresignDownloadPayload {
  return storagePresignDownloadPayload(keyFromStorageRef(refText), { disposition: 'inline' })
}

export function storageAttachmentDownloadPayload(key: string): StoragePresignDownloadPayload {
  return storagePresignDownloadPayload(key, { disposition: 'attachment' })
}
