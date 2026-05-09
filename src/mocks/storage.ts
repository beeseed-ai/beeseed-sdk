import type { StorageObject } from '../core/types.js'

export const MOCK_DIRECTORIES = ['documents/', 'images/', 'exports/']

export const MOCK_OBJECTS: StorageObject[] = [
  { key: 'documents/产品需求.md', size: 15200, last_modified: '2026-05-08T14:00:00Z', content_type: 'text/markdown' },
  { key: 'documents/会议纪要.md', size: 8400, last_modified: '2026-05-09T10:00:00Z', content_type: 'text/markdown' },
  { key: 'images/架构图.png', size: 245000, last_modified: '2026-05-07T09:00:00Z', content_type: 'image/png' },
  { key: 'images/流程图.svg', size: 18000, last_modified: '2026-05-06T16:00:00Z', content_type: 'image/svg+xml' },
  { key: 'exports/report-2026-05.csv', size: 52000, last_modified: '2026-05-09T08:00:00Z', content_type: 'text/csv' },
]
