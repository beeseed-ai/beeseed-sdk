import { keyFromStorageRef } from './storage-ref.js'

export type StorageDownloadDisposition = 'inline' | 'attachment'

export interface StoragePresignDownloadPayload {
  key: string
  object_id?: string
  process?: string
  disposition?: StorageDownloadDisposition
}

export function storagePresignDownloadPayload(
  key: string,
  options: { objectId?: string; process?: string; disposition?: StorageDownloadDisposition } = {},
): StoragePresignDownloadPayload {
  const payload: StoragePresignDownloadPayload = { key }
  if (options.objectId) payload.object_id = options.objectId
  if (options.process) payload.process = options.process
  if (options.disposition) payload.disposition = options.disposition
  return payload
}

export function storagePreviewPresignPayload(refText: string, objectId?: string): StoragePresignDownloadPayload {
  return storagePresignDownloadPayload(keyFromStorageRef(refText), { objectId, disposition: 'inline' })
}

export function storageAttachmentDownloadPayload(key: string, objectId?: string): StoragePresignDownloadPayload {
  return storagePresignDownloadPayload(key, { objectId, disposition: 'attachment' })
}
