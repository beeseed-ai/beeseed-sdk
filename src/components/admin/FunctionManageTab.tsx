import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Braces, Clock3, KeyRound, Play, Plus, RefreshCw, Rocket, Save, ShieldCheck, StopCircle } from 'lucide-react'
import { ApiError } from '../../core/errors.js'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'

interface AppFunction {
  id: string
  slug: string
  name: string
  description: string
  auth_mode: 'public' | 'user' | 'admin'
  status: 'draft' | 'active' | 'disabled'
  active_version_id?: string
  active_version?: string
  last_invoked_at?: string
  updated_at: string
}

interface AppFunctionVersion {
  id: string
  function_id: string
  version_no: number
  source_code?: string
  source_hash: string
  runtime: string
  status: string
  created_at: string
}

interface FunctionDetail {
  function: AppFunction
  active_version?: AppFunctionVersion | null
  versions: AppFunctionVersion[]
}

interface Invocation {
  id: string
  request_id: string
  method: string
  path: string
  status: 'running' | 'succeeded' | 'failed'
  status_code?: number
  duration_ms: number
  error_message: string
  log_tail: string
  created_at: string
}

interface FunctionSecret {
  id: string
  name: string
  value_prefix: string
  updated_at: string
}

interface TestResult {
  status_code: number
  headers: Record<string, string>
  body?: string
  body_text?: string
  logs: string
  duration_ms: number
  error_message?: string
}

const defaultSource = `export default async function handler(req, ctx) {
  ctx.log.info("function invoked", { path: req.path });

  const rows = await ctx.db.query(
    "select name, score from customer_levels order by score desc limit $1",
    [20],
  );

  return Response.json({
    ok: true,
    user: ctx.auth.user,
    levels: rows,
  });
}`

function authLabel(mode: AppFunction['auth_mode']) {
  if (mode === 'public') return '公开'
  if (mode === 'admin') return '管理员'
  return '登录用户'
}

function statusLabel(status: AppFunction['status']) {
  if (status === 'active') return '已发布'
  if (status === 'disabled') return '已禁用'
  return '草稿'
}

function shortDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function responseBodyText(result: TestResult | null) {
  if (!result) return ''
  if (result.body_text) return result.body_text
  if (!result.body) return ''
  try {
    return atob(result.body)
  } catch {
    return String(result.body)
  }
}

export function FunctionManageTab() {
  const { api } = useBeeSeedContext()
  const [functions, setFunctions] = useState<AppFunction[]>([])
  const [selectedID, setSelectedID] = useState<string | null>(null)
  const [detail, setDetail] = useState<FunctionDetail | null>(null)
  const [invocations, setInvocations] = useState<Invocation[]>([])
  const [secrets, setSecrets] = useState<FunctionSecret[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [slug, setSlug] = useState('customer-level')
  const [name, setName] = useState('客户等级')
  const [description, setDescription] = useState('读取 App 自定义业务表并返回 JSON。')
  const [authMode, setAuthMode] = useState<AppFunction['auth_mode']>('user')
  const [sourceCode, setSourceCode] = useState(defaultSource)
  const [testMethod, setTestMethod] = useState('GET')
  const [testPath, setTestPath] = useState('/functions/customer-level')
  const [testBody, setTestBody] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [secretName, setSecretName] = useState('')
  const [secretValue, setSecretValue] = useState('')

  async function loadFunctions(keepSelection = true) {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('admin/functions').json<{ items: AppFunction[] }>()
      const items = data.items ?? []
      setFunctions(items)
      const nextID = keepSelection && selectedID ? selectedID : items[0]?.id ?? null
      setSelectedID(nextID)
      if (nextID) {
        await loadDetail(nextID)
      } else {
        setDetail(null)
        setInvocations([])
      }
      await loadSecrets()
    } catch {
      setError('云函数加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: string) {
    const data = await api.get(`admin/functions/${id}`).json<FunctionDetail>()
    setDetail(data)
    const fn = data.function
    setSlug(fn.slug)
    setName(fn.name)
    setDescription(fn.description)
    setAuthMode(fn.auth_mode)
    setSourceCode(data.active_version?.source_code || defaultSource)
    setTestPath(`/functions/${fn.slug}`)
    const logs = await api.get(`admin/functions/${id}/invocations`, { searchParams: { limit: '30' } }).json<{ items: Invocation[] }>()
    setInvocations(logs.items ?? [])
  }

  async function loadSecrets() {
    const data = await api.get('admin/function-secrets').json<{ items: FunctionSecret[] }>()
    setSecrets(data.items ?? [])
  }

  useEffect(() => {
    void loadFunctions(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => functions.find((item) => item.id === selectedID) ?? null, [functions, selectedID])

  async function selectFunction(id: string) {
    setSelectedID(id)
    setNotice('')
    setError('')
    setTestResult(null)
    try {
      await loadDetail(id)
    } catch {
      setError('函数详情加载失败')
    }
  }

  async function createFunction(publish = true) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await api.post('admin/functions', {
        json: {
          slug,
          name,
          description,
          auth_mode: authMode,
          source_code: sourceCode,
          publish,
        },
      }).json<{ function: AppFunction }>()
      setNotice(publish ? '函数已创建并发布' : '函数草稿已创建')
      setSelectedID(data.function.id)
      await loadFunctions(true)
      await loadDetail(data.function.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建函数失败')
    } finally {
      setSaving(false)
    }
  }

  async function saveDraft(publish: boolean) {
    if (!selectedID) {
      await createFunction(publish)
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.patch(`admin/functions/${selectedID}`, {
        json: { name, description, auth_mode: authMode },
      })
      await api.post(`admin/functions/${selectedID}/versions`, {
        json: { source_code: sourceCode, publish },
      })
      setNotice(publish ? '函数已保存并发布' : '新版本草稿已保存')
      await loadFunctions(true)
      await loadDetail(selectedID)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存函数失败')
    } finally {
      setSaving(false)
    }
  }

  async function disableFunction() {
    if (!selectedID) return
    setSaving(true)
    setError('')
    try {
      await api.post(`admin/functions/${selectedID}/disable`)
      setNotice('函数已禁用')
      await loadFunctions(true)
      await loadDetail(selectedID)
    } catch {
      setError('禁用函数失败')
    } finally {
      setSaving(false)
    }
  }

  async function testFunction() {
    if (!selectedID) {
      setError('请先创建函数')
      return
    }
    setTesting(true)
    setError('')
    setTestResult(null)
    try {
      const result = await api.post(`admin/functions/${selectedID}/test`, {
        json: {
          source_code: sourceCode,
          method: testMethod,
          path: testPath,
          body: testBody,
        },
      }).json<TestResult>()
      setTestResult(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '测试调用失败')
    } finally {
      setTesting(false)
    }
  }

  async function saveSecret() {
    const key = secretName.trim().toUpperCase()
    if (!key || !secretValue) return
    setSaving(true)
    setError('')
    try {
      await api.put(`admin/function-secrets/${encodeURIComponent(key)}`, { json: { value: secretValue } })
      setSecretName('')
      setSecretValue('')
      await loadSecrets()
    } catch {
      setError('保存密钥失败')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSecret(key: string) {
    setSaving(true)
    setError('')
    try {
      await api.delete(`admin/function-secrets/${encodeURIComponent(key)}`)
      await loadSecrets()
    } catch {
      setError('删除密钥失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-hidden bg-[#f8fafc]">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-[#181d26]">云函数</h3>
              <p className="text-xs text-muted-foreground">App 范围内的 HTTP 函数</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              setSelectedID(null)
              setDetail(null)
              setSlug('customer-level')
              setName('客户等级')
              setDescription('读取 App 自定义业务表并返回 JSON。')
              setAuthMode('user')
              setSourceCode(defaultSource)
              setTestPath('/functions/customer-level')
            }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[calc(100vh-148px)] overflow-auto p-2">
            {functions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void selectFunction(item.id)}
                className={cn(
                  'mb-1 w-full rounded-md border px-3 py-2 text-left transition-colors',
                  selectedID === item.id ? 'border-[#181d26] bg-[#f8fafc]' : 'border-transparent hover:bg-[#f8fafc]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-[#181d26]">{item.name}</span>
                  <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>{statusLabel(item.status)}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">/functions/{item.slug}</p>
                <p className="mt-1 text-xs text-muted-foreground">{authLabel(item.auth_mode)} · v{item.active_version || '-'}</p>
              </button>
            ))}
            {!loading && functions.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                还没有云函数
              </div>
            )}
          </div>
        </aside>

        <main className="h-full overflow-auto">
          <div className="mx-auto max-w-6xl space-y-5 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-medium text-[#181d26]">{selected ? selected.name : '新建云函数'}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  使用 JS 编写 App 级 HTTP 函数，通过受控 ctx 访问用户、数据库和密钥。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void loadFunctions(true)} disabled={loading}>
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                  刷新
                </Button>
                <Button variant="outline" onClick={() => void saveDraft(false)} disabled={saving}>
                  <Save className="h-4 w-4" />
                  保存草稿
                </Button>
                <Button onClick={() => void saveDraft(true)} disabled={saving}>
                  <Rocket className="h-4 w-4" />
                  发布
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            {notice && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                {notice}
              </div>
            )}

            <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">函数名称</span>
                    <Input value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Slug</span>
                    <Input value={slug} onChange={(event) => {
                      const value = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                      setSlug(value)
                      setTestPath(`/functions/${value || 'customer-level'}`)
                    }} disabled={Boolean(selectedID)} />
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">说明</span>
                    <Input value={description} onChange={(event) => setDescription(event.target.value)} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">访问权限</span>
                    <select
                      value={authMode}
                      onChange={(event) => setAuthMode(event.target.value as AppFunction['auth_mode'])}
                      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                    >
                      <option value="user">登录用户</option>
                      <option value="admin">管理员</option>
                      <option value="public">公开</option>
                    </select>
                  </label>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">当前版本</span>
                    <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-[#f8fafc] px-3 text-sm">
                      <Braces className="h-4 w-4 text-muted-foreground" />
                      {detail?.active_version ? `v${detail.active_version.version_no} · ${detail.active_version.runtime}` : '未发布'}
                    </div>
                  </div>
                </div>

                <label className="mt-4 block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">函数代码</span>
                  <textarea
                    value={sourceCode}
                    onChange={(event) => setSourceCode(event.target.value)}
                    spellCheck={false}
                    className="min-h-[360px] w-full resize-y rounded-md border border-border bg-[#0d1218] p-4 font-mono text-sm leading-6 text-white outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-white p-4">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-[#181d26]">
                    <Play className="h-4 w-4" />
                    测试调用
                  </h4>
                  <div className="mt-3 space-y-3">
                    <select
                      value={testMethod}
                      onChange={(event) => setTestMethod(event.target.value)}
                      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                    >
                      <option>GET</option>
                      <option>POST</option>
                      <option>PUT</option>
                      <option>DELETE</option>
                    </select>
                    <Input value={testPath} onChange={(event) => setTestPath(event.target.value)} />
                    <textarea
                      value={testBody}
                      onChange={(event) => setTestBody(event.target.value)}
                      placeholder='{"hello":"world"}'
                      className="min-h-24 w-full resize-y rounded-md border border-border bg-white p-3 font-mono text-xs outline-none focus:border-[#9297a0] focus:ring-2 focus:ring-[#9297a0]/20"
                    />
                    <Button className="w-full" onClick={() => void testFunction()} disabled={testing || !selectedID}>
                      <Play className="h-4 w-4" />
                      {testing ? '执行中' : '运行测试'}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-white p-4">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-[#181d26]">
                    <KeyRound className="h-4 w-4" />
                    Secrets
                  </h4>
                  <div className="mt-3 space-y-2">
                    <Input value={secretName} onChange={(event) => setSecretName(event.target.value.toUpperCase())} placeholder="STRIPE_SECRET" />
                    <Input value={secretValue} onChange={(event) => setSecretValue(event.target.value)} placeholder="密钥值" type="password" />
                    <Button variant="outline" className="w-full" onClick={() => void saveSecret()} disabled={saving || !secretName || !secretValue}>
                      保存密钥
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {secrets.map((secret) => (
                      <div key={secret.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
                        <span className="font-mono">{secret.name}</span>
                        <button className="text-muted-foreground hover:text-red-600" onClick={() => void deleteSecret(secret.name)}>删除</button>
                      </div>
                    ))}
                    {secrets.length === 0 && <p className="text-xs text-muted-foreground">暂无密钥</p>}
                  </div>
                </div>

                {selected?.status === 'active' && (
                  <Button variant="outline" className="w-full text-red-600" onClick={() => void disableFunction()} disabled={saving}>
                    <StopCircle className="h-4 w-4" />
                    禁用函数
                  </Button>
                )}
              </div>
            </section>

            {testResult && (
              <section className="rounded-lg border border-border bg-white p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant={testResult.error_message ? 'destructive' : 'default'}>{testResult.status_code}</Badge>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    {testResult.duration_ms} ms
                  </span>
                  {testResult.error_message && <span className="text-red-600">{testResult.error_message}</span>}
                </div>
                <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-[#0d1218] p-4 text-xs leading-5 text-white">{responseBodyText(testResult)}</pre>
                {testResult.logs && <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-[#f8fafc] p-3 text-xs text-[#333840]">{testResult.logs}</pre>}
              </section>
            )}

            <section className="rounded-lg border border-border bg-white">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h4 className="text-sm font-medium text-[#181d26]">调用记录</h4>
                {selectedID && <Button variant="outline" size="sm" onClick={() => void loadDetail(selectedID)}>刷新记录</Button>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#f8fafc] text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">时间</th>
                      <th className="px-4 py-2 font-medium">请求</th>
                      <th className="px-4 py-2 font-medium">状态</th>
                      <th className="px-4 py-2 font-medium">耗时</th>
                      <th className="px-4 py-2 font-medium">错误</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invocations.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{shortDate(item.created_at)}</td>
                        <td className="px-4 py-2 font-mono text-xs">{item.method} {item.path}</td>
                        <td className="px-4 py-2">
                          <Badge variant={item.status === 'succeeded' ? 'default' : 'destructive'}>{item.status_code || item.status}</Badge>
                        </td>
                        <td className="px-4 py-2 text-xs">{item.duration_ms} ms</td>
                        <td className="max-w-[280px] truncate px-4 py-2 text-xs text-red-600">{item.error_message}</td>
                      </tr>
                    ))}
                    {invocations.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">暂无调用记录</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
