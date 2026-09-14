import { describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import type { Task } from '../core/types.js'
import { createTasksStore, type TasksState } from './tasks.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const readMethods = ['fetchProjects', 'fetchTasks', 'fetchMetrics', 'fetchScheduledTasks', 'fetchCalendar'] as const
const a = { id: 'task-a', channel_id: 'a', title: 'A', status: 'pending' } as Task
const b = { id: 'task-b', channel_id: 'b', title: 'B', status: 'pending' } as Task
const response = { projects: [{ id: 'a' }], tasks: [a], scheduled_tasks: [{ id: 'a' }], events: [{ id: 'a' }], ready: 99 }

describe('任务展示按当前频道隔离', () => {
  it.each(readMethods)('%s 的旧响应不能覆盖新频道或提前结束其加载', async (method) => {
    const result = deferred<unknown>()
    const api = { get: vi.fn(() => ({ json: () => result.promise })) } as unknown as KyInstance
    const store = createTasksStore({ api })
    store.getState().selectChannel('a')
    const pending = store.getState()[method]('a')
    store.getState().selectChannel('b')
    store.setState({ tasks: [b], loading: true, metricsLoading: true, schedulesLoading: true })
    const before = store.getState()
    result.resolve(response)
    await pending
    expect(store.getState()).toBe(before)
  })

  it('A→B→A 重新发请求，旧代次响应不覆盖新一轮 A', async () => {
    const old = deferred<unknown>(), fresh = deferred<unknown>()
    const get = vi.fn().mockReturnValueOnce({ json: () => old.promise }).mockReturnValueOnce({ json: () => fresh.promise })
    const store = createTasksStore({ api: { get } as unknown as KyInstance })
    store.getState().selectChannel('a')
    const first = store.getState().fetchTasks('a')
    store.getState().selectChannel('b')
    store.getState().selectChannel('a')
    const second = store.getState().fetchTasks('a')
    expect(get).toHaveBeenCalledTimes(2)
    fresh.resolve({ tasks: [{ ...a, title: '新结果' }] })
    await second
    old.resolve({ tasks: [a] })
    await first
    expect(store.getState().tasks[0].title).toBe('新结果')
  })

  it('非当前频道后台刷新不请求、不清空当前任务', async () => {
    const get = vi.fn()
    const store = createTasksStore({ api: { get } as unknown as KyInstance })
    store.getState().selectChannel('b')
    store.setState({ tasks: [b] })
    await Promise.all(readMethods.map((method) => store.getState()[method]('a')))
    expect(get).not.toHaveBeenCalled()
    expect(store.getState().tasks).toEqual([b])
  })

  const mutations: [string, (state: TasksState) => Promise<unknown>][] = [
    ['createTask', (s) => s.createTask('a', { title: 'A' })],
    ['getTask', (s) => s.getTask('a', 'task-a')],
    ['updateTask', (s) => s.updateTask('a', 'task-a', { title: 'edited' })],
    ['deleteTask', (s) => s.deleteTask('a', 'task-a')],
    ['createScheduledTask', (s) => s.createScheduledTask('a', { title: 'A' })],
    ['updateScheduledTask', (s) => s.updateScheduledTask('a', 'schedule-a', { enabled: false })],
    ['deleteScheduledTask', (s) => s.deleteScheduledTask('a', 'schedule-a')],
  ]
  it.each(mutations)('%s 的写回不能修改已经切换的频道', async (_name, act) => {
    const result = deferred<unknown>()
    const request = vi.fn(() => ({ json: () => result.promise }))
    const api = { get: request, post: request, patch: request, delete: () => result.promise } as unknown as KyInstance
    const store = createTasksStore({ api })
    store.getState().selectChannel('a')
    const pending = act(store.getState())
    store.getState().selectChannel('b')
    store.setState({ tasks: [b] })
    const before = store.getState()
    result.resolve({ ...a, schedule: { id: 'schedule-a', channel_id: 'a' } })
    await pending
    expect(store.getState()).toBe(before)
  })

  it('退出后旧请求不恢复任务数据', async () => {
    const result = deferred<unknown>()
    const store = createTasksStore({ api: { get: () => ({ json: () => result.promise }) } as unknown as KyInstance })
    store.getState().selectChannel('a')
    const pending = store.getState().fetchTasks('a')
    store.getState().reset()
    result.resolve({ tasks: [a] })
    await pending
    expect(store.getState().channelId).toBeNull()
    expect(store.getState().tasks).toEqual([])
  })
})
