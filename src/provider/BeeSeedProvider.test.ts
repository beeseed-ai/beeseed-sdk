import { describe, expect, it, vi } from 'vitest'
import type { TasksStore } from '../stores/tasks.js'
import { refreshTaskSurfaces } from './BeeSeedProvider.js'

describe('refreshTaskSurfaces', () => {
  it('refreshes every task surface after a task mutation event', () => {
    const state = {
      channelId: 'channel-1',
      fetchProjects: vi.fn().mockResolvedValue(undefined),
      fetchTasks: vi.fn().mockResolvedValue(undefined),
      fetchScheduledTasks: vi.fn().mockResolvedValue(undefined),
      fetchCalendar: vi.fn().mockResolvedValue(undefined),
      fetchMetrics: vi.fn().mockResolvedValue(undefined),
    }
    const store = { getState: () => state } as unknown as TasksStore

    refreshTaskSurfaces(store, 'channel-1')

    expect(state.fetchProjects).toHaveBeenCalledWith('channel-1')
    expect(state.fetchTasks).toHaveBeenCalledWith('channel-1')
    expect(state.fetchScheduledTasks).toHaveBeenCalledWith('channel-1')
    expect(state.fetchCalendar).toHaveBeenCalledWith('channel-1')
    expect(state.fetchMetrics).toHaveBeenCalledWith('channel-1')
  })

  it('ignores task events from a different channel', () => {
    const state = {
      channelId: 'current',
      fetchProjects: vi.fn(), fetchTasks: vi.fn(), fetchScheduledTasks: vi.fn(),
      fetchCalendar: vi.fn(), fetchMetrics: vi.fn(),
    }
    refreshTaskSurfaces({ getState: () => state } as unknown as TasksStore, 'background')
    for (const callback of [state.fetchProjects, state.fetchTasks, state.fetchScheduledTasks, state.fetchCalendar, state.fetchMetrics]) {
      expect(callback).not.toHaveBeenCalled()
    }
  })
})
