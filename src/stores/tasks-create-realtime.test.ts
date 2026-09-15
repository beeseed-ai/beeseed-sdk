import { describe, expect, it } from 'vitest'
import type { KyInstance } from 'ky'
import type { Task, TaskSchedule } from '../core/types.js'
import { createTasksStore } from './tasks.js'

describe('创建回执晚于实时列表刷新', () => {
  it('普通任务只出现一次，并保留已经刷新的新状态', async () => {
    let complete!: (value: Task) => void
    const response = new Promise<Task>((resolve) => { complete = resolve })
    const created = { id: 'task-1', channel_id: 'a', title: 'QA', status: 'pending' } as Task
    const fresh = { ...created, status: 'in_progress' } as Task
    const api = {
      post: () => ({ json: () => response }),
      get: () => ({ json: async () => ({ tasks: [fresh] }) }),
    } as unknown as KyInstance
    const store = createTasksStore({ api })
    store.getState().selectChannel('a')
    const pending = store.getState().createTask('a', { title: 'QA' })
    await store.getState().fetchTasks('a')
    complete(created)
    await pending
    expect(store.getState().tasks).toEqual([fresh])
  })

  it('计划只出现一次，并保留实时列表中的展示字段', async () => {
    let complete!: (value: { schedule: TaskSchedule }) => void
    const response = new Promise<{ schedule: TaskSchedule }>((resolve) => { complete = resolve })
    const created = { id: 'schedule-1', channel_id: 'a', kind: 'recurring', enabled: true } as TaskSchedule
    const fresh = { ...created, template_title: 'QA', enabled: false }
    const api = {
      post: () => ({ json: () => response }),
      get: () => ({ json: async () => ({ scheduled_tasks: [fresh] }) }),
    } as unknown as KyInstance
    const store = createTasksStore({ api })
    store.getState().selectChannel('a')
    const pending = store.getState().createScheduledTask('a', { title: 'QA' })
    await store.getState().fetchScheduledTasks('a')
    complete({ schedule: created })
    await pending
    expect(store.getState().scheduledTasks).toEqual([fresh])
  })
})
