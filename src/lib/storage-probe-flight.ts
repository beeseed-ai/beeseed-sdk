interface ProbeScope {
  session: string | null
  pending: Map<string, Promise<boolean>>
}
const scopes = new WeakMap<object, ProbeScope>()

/** 合并进行中的请求，不永久缓存存在性或保存预签名 URL。 */
export function shareStorageProbe(client: object, session: string | null, key: string, check: () => Promise<boolean>): Promise<boolean> {
  let scope = scopes.get(client)
  if (!scope || scope.session !== session) {
    scope = { session, pending: new Map() }
    scopes.set(client, scope)
  }
  const existing = scope.pending.get(key)
  if (existing) return existing
  const pending = scope.pending
  const request = Promise.resolve().then(check).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
