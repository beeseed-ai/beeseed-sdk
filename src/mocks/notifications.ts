import type { AppNotification } from '../core/types.js'

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  { id: 1, user_id: 'u1', type: 'task_assigned', title: '新任务分配', content: '你被分配了任务：实现 OAuth 集成', is_read: false, created_at: '2026-05-09T14:00:00Z' },
  { id: 2, user_id: 'u1', type: 'task_completed', title: '任务完成', content: 'Designer 完成了任务：设计新的登录页面', is_read: false, created_at: '2026-05-08T18:00:00Z' },
  { id: 3, user_id: 'u1', type: 'knowledge_ready', title: '知识库就绪', content: '文档 "API 接口规范.md" 处理完成', is_read: true, created_at: '2026-05-07T10:00:00Z' },
  { id: 4, user_id: 'u1', type: 'system', title: '系统更新', content: '平台已更新到最新版本', is_read: true, created_at: '2026-05-06T09:00:00Z' },
]
