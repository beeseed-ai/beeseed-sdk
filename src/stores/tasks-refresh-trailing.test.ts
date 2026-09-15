import { describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import { createTasksStore } from './tasks.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const reads = [
  ['fetchTasks', 'tasks', 'tasks'],
  ['fetchScheduledTasks', 'scheduled_tasks', 'scheduledTasks'],
  ['fetchCalendar', 'events', 'calendarEvents'],
  ['fetchProjects', 'projects', 'projects'],
] as const

describe('连续任务变更最终读取最新状态', () => {
  it.each(reads)('%s 不丢弃读取期间的删除通知', async (method, field, stateField) => {
    const old = deferred<unknown>()
    const get = vi.fn()
      .mockReturnValueOnce({ json: () => old.promise })
      .mockReturnValue({ json: async () => ({ [field]: [] }) })
    const store = createTasksStore({ api: { get } as unknown as KyInstance })
    store.getState().selectChannel('a')
    const first = store.getState()[method]('a')
    const notifications = Array.from({ length: 6 }, () => store.getState()[method]('a'))
    expect(get).toHaveBeenCalledTimes(1)
    old.resolve({ [field]: [{ id: 'deleted-item' }] })
    await Promise.all([first, ...notifications])
    expect(store.getState()[stateField]).toEqual([])
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('指标也在运行中的刷新后读取最终计数', async () => {
    const old = deferred<unknown>()
    const get = vi.fn().mockReturnValueOnce({ json: () => old.promise })
      .mockReturnValue({ json: async () => ({ ready: 0 }) })
    const store = createTasksStore({ api: { get } as unknown as KyInstance })
    store.getState().selectChannel('a')
    const first = store.getState().fetchMetrics('a')
    const next = store.getState().fetchMetrics('a')
    old.resolve({ ready: 1 })
    await Promise.all([first, next])
    expect(store.getState().metrics?.ready).toBe(0)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('离开频道后不执行旧代次排队的读取', async () => {
    const old = deferred<unknown>()
    const get = vi.fn().mockReturnValue({ json: () => old.promise })
    const store = createTasksStore({ api: { get } as unknown as KyInstance })
    store.getState().selectChannel('a')
    const first = store.getState().fetchTasks('a')
    const next = store.getState().fetchTasks('a')
    store.getState().selectChannel('b')
    store.getState().selectChannel('a')
    old.resolve({ tasks: [{ id: 'old-a' }] })
    await Promise.all([first, next])
    expect(store.getState().tasks).toEqual([])
    expect(get).toHaveBeenCalledTimes(1)
  })
})
