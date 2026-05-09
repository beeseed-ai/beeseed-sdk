import type { KnowledgeSource, KnowledgeSearchResult, KnowledgeEntity, KnowledgeGraphData } from '../core/types.js'

export const MOCK_SOURCES: KnowledgeSource[] = [
  { id: 1, title: '产品设计文档.md', source_type: 'file_upload', file_size: 45000, status: 'ready', summary: '产品 v2 的核心设计方案，包含用户流程和技术架构', chunk_count: 12, tags: ['design', 'v2'], created_at: '2026-05-01T00:00:00Z' },
  { id: 2, title: 'API 接口规范.md', source_type: 'file_upload', file_size: 32000, status: 'ready', summary: 'REST API 接口文档，覆盖认证、资源管理、WebSocket', chunk_count: 8, tags: ['api', 'docs'], created_at: '2026-05-03T00:00:00Z' },
  { id: 3, title: '竞品分析报告', source_type: 'chat_distillation', file_size: 0, status: 'ready', summary: '从讨论中提取的竞品分析要点', chunk_count: 5, tags: ['analysis'], created_at: '2026-05-07T00:00:00Z' },
  { id: 4, title: '技术选型文档.pdf', source_type: 'file_upload', file_size: 120000, mime_type: 'application/pdf', status: 'processing', chunk_count: 0, tags: [], created_at: '2026-05-09T00:00:00Z' },
]

export const MOCK_SEARCH_RESULTS: KnowledgeSearchResult[] = [
  { chunk_id: 1, content: '用户认证采用 JWT + Refresh Token 双 token 方案，access token 有效期 15 分钟...', similarity: 0.92, source_id: 2, source_title: 'API 接口规范.md' },
  { chunk_id: 2, content: '产品核心价值：让每个团队都能拥有自己的 AI 助手...', similarity: 0.85, source_id: 1, source_title: '产品设计文档.md' },
]

export const MOCK_ENTITIES: KnowledgeEntity[] = [
  { id: 1, name: 'JWT', entity_type: 'technology', description: 'JSON Web Token，用于认证', aliases: ['json web token'], mention_count: 8 },
  { id: 2, name: 'OAuth', entity_type: 'protocol', description: '开放授权协议', aliases: ['OAuth 2.0'], mention_count: 5 },
  { id: 3, name: 'WebSocket', entity_type: 'technology', description: '全双工通信协议', aliases: ['WS', 'WSS'], mention_count: 12 },
]

export const MOCK_GRAPH: KnowledgeGraphData = {
  nodes: [
    { id: 's-1', node_type: 'source', title: '产品设计文档.md', chunk_count: 12 },
    { id: 's-2', node_type: 'source', title: 'API 接口规范.md', chunk_count: 8 },
    { id: 'e-1', node_type: 'entity', title: 'JWT', entity_type: 'technology' },
    { id: 'e-2', node_type: 'entity', title: 'OAuth', entity_type: 'protocol' },
    { id: 'e-3', node_type: 'entity', title: 'WebSocket', entity_type: 'technology' },
  ],
  edges: [
    { source: 's-2', target: 'e-1', weight: 0.9, type: 'mentions' },
    { source: 's-2', target: 'e-3', weight: 0.8, type: 'mentions' },
    { source: 's-1', target: 'e-2', weight: 0.7, type: 'mentions' },
    { source: 'e-1', target: 'e-2', weight: 0.6, type: 'related_to', description: '认证方案' },
  ],
}
