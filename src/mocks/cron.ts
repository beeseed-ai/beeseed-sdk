import type { CronJob } from '../core/types.js'

export const MOCK_CRON_JOBS: CronJob[] = [
  { id: 'cron-1', room_id: 'room-1', cron_expr: '0 9 * * 1-5', message: '请生成今日工作计划', timezone: 'Asia/Shanghai', enabled: true, last_run: '2026-05-09T09:00:00Z', created_at: '2026-05-01T00:00:00Z' },
  { id: 'cron-2', room_id: 'room-1', cron_expr: '0 18 * * 5', message: '请总结本周工作进展', timezone: 'Asia/Shanghai', enabled: true, last_run: '2026-05-09T18:00:00Z', created_at: '2026-05-02T00:00:00Z' },
  { id: 'cron-3', room_id: 'room-1', cron_expr: '*/30 * * * *', message: '检查系统健康状态', timezone: 'Asia/Shanghai', enabled: false, created_at: '2026-05-05T00:00:00Z' },
]
