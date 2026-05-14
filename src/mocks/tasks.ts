import type { CalendarEvent, Project, Task, TaskComment, TaskSchedule } from '../core/types.js'

export const MOCK_PROJECTS: Project[] = [
  { id: 'proj-1', channel_id: 'channel-1', title: '产品 v2.0 开发', status: 'active', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-09T00:00:00Z', task_count: 4, done_count: 1 },
  { id: 'proj-2', channel_id: 'channel-1', title: '用户反馈处理', status: 'active', created_at: '2026-05-05T00:00:00Z', updated_at: '2026-05-09T00:00:00Z', task_count: 2, done_count: 0 },
]

export const MOCK_TASKS: Task[] = [
  { id: 'task-1', channel_id: 'channel-1', project_id: 'proj-1', title: '设计新的登录页面', status: 'done', priority: 1, assigned_type: 'agent', assigned_name: 'Designer', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-08T00:00:00Z' },
  { id: 'task-2', channel_id: 'channel-1', project_id: 'proj-1', title: '实现 OAuth 集成', status: 'in_progress', priority: 2, assigned_type: 'user', assigned_name: '张三', due_at: '2026-05-15T00:00:00Z', created_at: '2026-05-02T00:00:00Z', updated_at: '2026-05-09T00:00:00Z' },
  { id: 'task-3', channel_id: 'channel-1', project_id: 'proj-1', title: '编写 API 文档', status: 'pending', priority: 3, created_at: '2026-05-03T00:00:00Z', updated_at: '2026-05-03T00:00:00Z' },
  { id: 'task-4', channel_id: 'channel-1', project_id: 'proj-1', title: '性能测试', status: 'blocked', priority: 2, description: '依赖 OAuth 集成完成', created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z' },
  { id: 'task-5', channel_id: 'channel-1', project_id: 'proj-2', title: '收集用户调研数据', status: 'in_progress', priority: 1, assigned_type: 'agent', assigned_name: 'Researcher', created_at: '2026-05-05T00:00:00Z', updated_at: '2026-05-09T00:00:00Z' },
  { id: 'task-6', channel_id: 'channel-1', project_id: 'proj-2', title: '生成反馈报告', status: 'pending', priority: 2, created_at: '2026-05-06T00:00:00Z', updated_at: '2026-05-06T00:00:00Z' },
]

export const MOCK_COMMENTS: TaskComment[] = [
  { id: 1, task_id: 'task-2', author_type: 'user', content: '已完成 Google OAuth，下一步接入 GitHub', comment_type: 'progress', created_at: '2026-05-08T10:00:00Z' },
  { id: 2, task_id: 'task-2', author_type: 'agent', content: '建议同时考虑 SAML SSO 方案', comment_type: 'comment', created_at: '2026-05-08T10:05:00Z' },
]

export const MOCK_TASK_SCHEDULES: TaskSchedule[] = [
  {
    id: 'schedule-1',
    channel_id: 'channel-1',
    task_template_id: 'task-template-1',
    kind: 'recurring',
    template_title: '生成工作日报',
    timezone: 'Asia/Shanghai',
    recurrence_rule: 'CRON:0 9 * * 1-5',
    next_fire_at: '2026-05-15T01:00:00Z',
    enabled: true,
    overlap_policy: 'skip',
    catch_up_policy: 'latest',
    created_at: '2026-05-09T00:00:00Z',
    updated_at: '2026-05-09T00:00:00Z',
  },
]

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'schedule:schedule-1:2026-05-15T01:00:00Z',
    type: 'projected_occurrence',
    title: '生成工作日报',
    start_at: '2026-05-15T01:00:00Z',
    status: 'scheduled',
    schedule_id: 'schedule-1',
    occurrence_at: '2026-05-15T01:00:00Z',
    is_recurring: true,
  },
]
