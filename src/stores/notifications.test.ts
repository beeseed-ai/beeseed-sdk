import { describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'

import type { AppNotification } from '../core/types.js'
import { createNotificationsStore } from './notifications.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function notification(id: number, createdAt: string): AppNotification {
  return {
    id,
    user_id: 'user-1',
    type: 'channel_invite',
    title: `频道邀请 ${id}`,
    is_read: false,
    created_at: createdAt,
  }
}

describe('通知列表刷新', () => {
  it('后发起的刷新完成后不会被较早响应覆盖', async () => {
    const first = deferred<{ notifications: AppNotification[] }>()
    const second = deferred<{ notifications: AppNotification[] }>()
    const get = vi.fn()
      .mockReturnValueOnce({ json: () => first.promise })
      .mockReturnValueOnce({ json: () => second.promise })
    const store = createNotificationsStore({ api: { get } as unknown as KyInstance })

    const firstRefresh = store.getState().refresh()
    const secondRefresh = store.getState().refresh()
    second.resolve({ notifications: [notification(2, '2026-07-31T03:00:00Z')] })
    await secondRefresh
    first.resolve({ notifications: [notification(1, '2026-07-31T02:00:00Z')] })
    await firstRefresh

    expect(store.getState().notifications.map((item) => item.id)).toEqual([2])
    expect(store.getState().unreadCount).toBe(1)
    expect(store.getState().loading).toBe(false)
  })

  it('刷新期间收到的 WebSocket 通知不会被旧响应覆盖', async () => {
    const first = deferred<{ notifications: AppNotification[] }>()
    const second = deferred<{ notifications: AppNotification[] }>()
    const get = vi.fn()
      .mockReturnValueOnce({ json: () => first.promise })
      .mockReturnValueOnce({ json: () => second.promise })
    const store = createNotificationsStore({ api: { get } as unknown as KyInstance })
    const existing = notification(1, '2026-07-31T01:00:00Z')
    const incoming = notification(2, '2026-07-31T02:00:00Z')

    const refresh = store.getState().refresh()
    store.getState().handleWsNotification(incoming)
    first.resolve({ notifications: [existing] })
    await refresh

    const nextRefresh = store.getState().refresh()
    second.resolve({ notifications: [existing] })
    await nextRefresh

    expect(store.getState().notifications.map((item) => item.id)).toEqual([2, 1])
    expect(store.getState().unreadCount).toBe(2)
    expect(store.getState().loading).toBe(false)
  })
})
