import type { AgentMeta } from '../core/types.js'

export const MOCK_AGENTS: AgentMeta[] = [
  { id: 'agent-1', model: 'deepseek-v4', provider: 'beeseed', display_name: '小助手', status: 'online', created_at: '2026-05-01T00:00:00Z' },
  { id: 'agent-2', model: 'doubao-seed-2-0-lite', provider: 'beeseed', display_name: '快速回复', status: 'online', created_at: '2026-05-03T00:00:00Z' },
  { id: 'agent-3', model: 'gpt-5.4', provider: 'beeseed', display_name: '深度分析', status: 'stopped', created_at: '2026-05-05T00:00:00Z' },
]
