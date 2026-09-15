import { describe, expect, it, vi } from 'vitest'
import type { KyInstance } from 'ky'
import { createStorageStore } from './storage.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
const object = (key: string, size = 10) => ({ key, name: key, size, content_type: 'text/plain', last_modified: '2026-09-15T00:00:00Z' })
const listing = (key: string) => ({ objects: [object(key)], common_prefixes: ['nested/'], usage: { objects: 1, bytes: 10 }, capabilities: { can_upload: true } })
function setup() {
  const get = vi.fn(), del = vi.fn(), post = vi.fn()
  const store = createStorageStore({ api: { get, delete: del, post } as unknown as KyInstance })
  return { store, get, del, post }
}

describe('storage channel view', () => {
  it('clears the old channel before the next request completes', async () => {
    const { store, get } = setup()
    get.mockReturnValueOnce({ json: async () => listing('a.txt') })
    await store.getState().browse('a')
    store.getState().setSearchQuery('a')
    store.getState().setPreviewObj(object('a.txt'))
    const next = deferred<ReturnType<typeof listing>>()
    get.mockReturnValueOnce({ json: () => next.promise })
    const pending = store.getState().browse('b')
    expect(store.getState()).toMatchObject({ objects: [], directories: [], usage: { bytes: 0, objects: 0 }, previewObj: null, searchQuery: '', loading: true, canUpload: false })
    next.resolve(listing('b.txt')); await pending
    expect(store.getState().objects[0].key).toBe('b.txt')
  })

  it('ignores old channel and old directory responses', async () => {
    const { store, get } = setup()
    const old = deferred<ReturnType<typeof listing>>()
    get.mockReturnValueOnce({ json: () => old.promise }).mockReturnValueOnce({ json: async () => listing('b.txt') })
    const pending = store.getState().browse('a')
    await store.getState().browse('b', 'new/')
    old.resolve(listing('a.txt')); await pending
    expect(store.getState()).toMatchObject({ currentPrefix: 'new/', objects: [object('b.txt')] })
    const oldDir = deferred<ReturnType<typeof listing>>()
    get.mockReturnValueOnce({ json: () => oldDir.promise }).mockReturnValueOnce({ json: async () => listing('newest.txt') })
    const directory = store.getState().browse('b', 'older/')
    await store.getState().browse('b', 'newest/')
    oldDir.resolve(listing('older.txt')); await directory
    expect(store.getState()).toMatchObject({ currentPrefix: 'newest/', objects: [object('newest.txt')] })
  })

  it('reset invalidates a pending response', async () => {
    const { store, get } = setup(), pending = deferred<ReturnType<typeof listing>>()
    get.mockReturnValue({ json: () => pending.promise })
    const request = store.getState().browse('a')
    store.getState().reset(); pending.resolve(listing('a.txt')); await request
    expect(store.getState().objects).toEqual([])
  })

  it('deleting refreshes authoritative usage without reopening the panel', async () => {
    const { store, get, del } = setup()
    get.mockReturnValueOnce({ json: async () => listing('a.txt') }).mockReturnValueOnce({ json: async () => ({ objects: [], common_prefixes: [], usage: { bytes: 0, objects: 0 } }) })
    del.mockResolvedValue({})
    await store.getState().browse('a'); await store.getState().deleteFile('a', 'a.txt')
    expect(store.getState()).toMatchObject({ objects: [], usage: { objects: 0, bytes: 0 }, notice: '文件已删除' })
    get.mockReturnValueOnce({ json: async () => listing('b.txt') })
    await store.getState().browse('b')
    expect(store.getState().notice).toBeNull()
    store.setState({ notice: '文件已删除' })
    store.getState().reset()
    expect(store.getState().notice).toBeNull()
  })

  it('delete failure preserves the file and exposes a retry message', async () => {
    const { store, get, del } = setup()
    get.mockReturnValue({ json: async () => listing('a.txt') }); del.mockRejectedValue(new Error('network failed'))
    await store.getState().browse('a'); await store.getState().deleteFile('a', 'a.txt')
    expect(store.getState().objects).toEqual([object('a.txt')])
    expect(store.getState()).toMatchObject({ error: '文件删除失败，请重试。', notice: null })
  })

  it('a late delete cannot remove the same key from another channel', async () => {
    const { store, get, del } = setup(), deletion = deferred<unknown>()
    get.mockReturnValue({ json: async () => listing('same.txt') }); del.mockReturnValue(deletion.promise)
    await store.getState().browse('a'); const pending = store.getState().deleteFile('a', 'same.txt')
    await store.getState().browse('b'); deletion.resolve({}); await pending
    expect(store.getState().objects).toEqual([object('same.txt')])
    expect(store.getState().notice).toBeNull()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('late directory creation does not navigate back to the old channel', async () => {
    const { store, get, post } = setup(), creation = deferred<unknown>()
    get.mockReturnValue({ json: async () => listing('file.txt') }); post.mockReturnValue(creation.promise)
    await store.getState().browse('a'); const pending = store.getState().createDirectory('a', 'folder')
    await store.getState().browse('b'); creation.resolve({}); await pending
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('an old listing failure cannot replace the new successful view', async () => {
    const { store, get } = setup(), old = deferred<unknown>()
    get.mockReturnValueOnce({ json: () => old.promise }).mockReturnValueOnce({ json: async () => listing('b.txt') })
    const pending = store.getState().browse('a'); await store.getState().browse('b')
    old.reject(new Error('old request failed')); await pending
    expect(store.getState()).toMatchObject({ objects: [object('b.txt')], error: null, loading: false })
  })

  it('upload completion after a channel switch cannot replace its files or start a stale refresh', async () => {
    const { store, get, post } = setup(), completion = deferred<unknown>()
    class Upload {
      upload = { onprogress: undefined }; status = 200; onload = () => {}
      open() {} setRequestHeader() {}
      send() { this.onload() }
    }
    vi.stubGlobal('XMLHttpRequest', Upload)
    try {
      get.mockReturnValue({ json: async () => listing('b.txt') })
      post.mockReturnValueOnce({ json: async () => ({ object: { id: 'upload-id' }, upload_url: '/upload', method: 'PUT' }) })
        .mockReturnValueOnce({ json: () => completion.promise })
      await store.getState().browse('a')
      const pending = store.getState().uploadFile('a', new File(['new'], 'new.txt'))
      await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2))
      await store.getState().browse('b')
      completion.resolve(object('new.txt')); await pending
      expect(store.getState()).toMatchObject({ channelId: 'b', objects: [object('b.txt')], uploading: false, uploadError: null })
      expect(get).toHaveBeenCalledTimes(2)
    } finally { vi.unstubAllGlobals() }
  })
})
