import { describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import type { Task, TaskSchedule } from '../core/types.js'
import { createTasksStore } from './tasks.js'

describe('删除计划后的任务列表', () => {
  it('保留服务端返回的已执行任务并刷新其关联状态', async () => {
    const occurrence = { id: 'occurrence', channel_id: 'channel', title: '已执行任务', status: 'in_progress', scheduler_state: 'awaiting_verify', schedule_id: 'schedule' } as Task
    const retained = { ...occurrence, schedule_id: undefined }
    const get = vi.fn((path: string) => ({ json: async () => path.endsWith('/tasks') ? { tasks: [retained] } : {} }))
    const api = { delete: vi.fn().mockResolvedValue(undefined), get } as unknown as KyInstance
    const store = createTasksStore({ api })
    store.getState().selectChannel('channel')
    store.setState({ tasks: [occurrence], scheduledTasks: [{ id: 'schedule' } as TaskSchedule] })

    await store.getState().deleteScheduledTask('channel', 'schedule')

    expect(store.getState().scheduledTasks).toEqual([])
    expect(store.getState().tasks).toEqual([retained])
  })

  it('删除失败时保留计划及待验收任务', async () => {
    const task = { id: 'occurrence', schedule_id: 'schedule', scheduler_state: 'awaiting_verify' } as Task
    const schedule = { id: 'schedule' } as TaskSchedule
    const api = { delete: vi.fn().mockRejectedValue(new Error('unavailable')) } as unknown as KyInstance
    const store = createTasksStore({ api })
    store.getState().selectChannel('channel')
    store.setState({ tasks: [task], scheduledTasks: [schedule] })

    await store.getState().deleteScheduledTask('channel', 'schedule')

    expect(store.getState().tasks).toEqual([task])
    expect(store.getState().scheduledTasks).toEqual([schedule])
  })
})
