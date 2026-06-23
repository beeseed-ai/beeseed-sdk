import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Database, HardDrive, Play, Plus, RefreshCw, Table2, Terminal, Trash2 } from 'lucide-react'
import { ApiError } from '../../core/errors.js'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'

interface AppDatabaseUsage {
  schema_name: string
  schema_exists: boolean
  total_bytes: number
  total_size: string
  object_count: number
  objects: AppDatabaseObjectUsage[]
}

interface AppDatabaseObjectUsage {
  name: string
  type: string
  parent_table?: string
  total_bytes: number
  table_bytes: number
  index_bytes: number
  pretty_size: string
  counted_in_total: boolean
}

interface AppDatabaseCreatedTable {
  schema_name: string
  table_name: string
}

interface AppDatabaseSQLResult {
  schema_name: string
  statement_count: number
  results: AppDatabaseSQLStatementResult[]
}

interface AppDatabaseSQLStatementResult {
  statement: string
  command_tag: string
  rows_affected: number
  columns?: string[]
  rows?: Record<string, unknown>[]
  row_count: number
  truncated: boolean
  duration_ms: number
}

interface EditableColumn {
  key: string
  name: string
  type: string
  nullable: boolean
}

const objectTypeLabels: Record<string, string> = {
  table: '表',
  partitioned_table: '分区表',
  materialized_view: '物化视图',
  index: '索引',
  sequence: '序列',
  view: '视图',
  foreign_table: '外部表',
}

const columnTypes = [
  { value: 'text', label: 'Text' },
  { value: 'integer', label: 'Integer' },
  { value: 'bigint', label: 'Bigint' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'uuid', label: 'UUID' },
  { value: 'date', label: 'Date' },
  { value: 'timestamptz', label: 'Timestamp' },
  { value: 'jsonb', label: 'JSONB' },
]

function createKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

function objectTypeLabel(type: string) {
  return objectTypeLabels[type] || type
}

function UsageMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-medium tabular-nums text-[#181d26]">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function DatabaseManageTab() {
  const { api } = useBeeSeedContext()
  const [usage, setUsage] = useState<AppDatabaseUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tableName, setTableName] = useState('')
  const [formColumns, setFormColumns] = useState<EditableColumn[]>([
    { key: createKey(), name: 'name', type: 'text', nullable: false },
  ])
  const [withID, setWithID] = useState(true)
  const [withTimestamps, setWithTimestamps] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdTable, setCreatedTable] = useState<AppDatabaseCreatedTable | null>(null)
  const [sqlText, setSQLText] = useState(`select * from customer_levels limit 20;`)
  const [executingSQL, setExecutingSQL] = useState(false)
  const [sqlError, setSQLError] = useState('')
  const [sqlResult, setSQLResult] = useState<AppDatabaseSQLResult | null>(null)

  async function loadUsage() {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('admin/database/usage', { searchParams: { limit: '200' } }).json<AppDatabaseUsage>()
      setUsage(data)
    } catch {
      setUsage(null)
      setError('数据库用量加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const objects = useMemo(() => usage?.objects ?? [], [usage])

  function addColumn() {
    setFormColumns((prev) => [...prev, { key: createKey(), name: '', type: 'text', nullable: true }])
  }

  function updateColumn(key: string, patch: Partial<EditableColumn>) {
    setFormColumns((prev) => prev.map((col) => col.key === key ? { ...col, ...patch } : col))
  }

  function removeColumn(key: string) {
    setFormColumns((prev) => prev.length > 1 ? prev.filter((col) => col.key !== key) : prev)
  }

  async function createTable() {
    setCreating(true)
    setCreateError('')
    setCreatedTable(null)
    try {
      const created = await api.post('admin/database/tables', {
        json: {
          table_name: tableName,
          with_id: withID,
          with_timestamps: withTimestamps,
          columns: formColumns
            .map(({ name, type, nullable }) => ({ name: name.trim(), type, nullable }))
            .filter((col) => col.name),
        },
      }).json<AppDatabaseCreatedTable>()
      setCreatedTable(created)
      setTableName('')
      setFormColumns([{ key: createKey(), name: 'name', type: 'text', nullable: false }])
      setWithID(true)
      setWithTimestamps(true)
      await loadUsage()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCreateError('数据表已存在')
      } else if (err instanceof ApiError && err.status === 400) {
        setCreateError('表名、字段名或字段类型不符合规则')
      } else {
        setCreateError('创建数据表失败')
      }
    } finally {
      setCreating(false)
    }
  }

  async function executeSQL() {
    setExecutingSQL(true)
    setSQLError('')
    setSQLResult(null)
    try {
      const result = await api.post('admin/database/sql', {
        json: {
          sql: sqlText,
          max_rows: 100,
          timeout_ms: 8000,
        },
      }).json<AppDatabaseSQLResult>()
      setSQLResult(result)
      await loadUsage()
    } catch (err) {
      if (err instanceof ApiError) {
        setSQLError(err.message || 'SQL 执行失败')
      } else {
        setSQLError('SQL 执行失败')
      }
    } finally {
      setExecutingSQL(false)
    }
  }

  function renderSQLValue(value: unknown) {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return JSON.stringify(value)
  }

  return (
    <div className="h-full overflow-auto bg-[#f8fafc]">
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-medium text-[#181d26]">数据库</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              管理当前 App 独立 PostgreSQL schema 的空间占用和自定义数据表。
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadUsage()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <UsageMetric
            label="Schema"
            value={usage?.schema_name || '-'}
            hint={usage?.schema_exists ? '已初始化' : loading ? '加载中' : '未找到 schema'}
          />
          <UsageMetric
            label="总占用"
            value={usage ? (usage.total_size || formatBytes(usage.total_bytes)) : '-'}
            hint={usage ? `${usage.total_bytes.toLocaleString()} bytes` : '等待加载'}
          />
          <UsageMetric
            label="对象数量"
            value={usage ? String(usage.object_count) : '-'}
            hint="表、索引、序列和视图"
          />
        </div>

        <section className="rounded-lg border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#181d26]">
              <Database className="h-4 w-4" />
              新建数据表
            </div>
            <p className="mt-1 text-xs text-muted-foreground">表会创建在当前 App schema 中，只允许安全字段名和白名单类型。</p>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
              <label className="space-y-1.5 text-xs font-medium text-[#41454d]">
                表名
                <Input
                  value={tableName}
                  onChange={(event) => setTableName(event.target.value)}
                  placeholder="customer_levels"
                  disabled={creating}
                />
              </label>
              <div className="flex items-end gap-4">
                <label className="flex h-8 items-center gap-2 text-sm text-[#41454d]">
                  <input type="checkbox" checked={withID} onChange={(event) => setWithID(event.target.checked)} disabled={creating} />
                  id
                </label>
                <label className="flex h-8 items-center gap-2 text-sm text-[#41454d]">
                  <input type="checkbox" checked={withTimestamps} onChange={(event) => setWithTimestamps(event.target.checked)} disabled={creating} />
                  时间戳
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#41454d]">字段</span>
                <Button type="button" variant="outline" size="sm" onClick={addColumn} disabled={creating}>
                  <Plus className="h-3.5 w-3.5" />
                  添加字段
                </Button>
              </div>
              {formColumns.map((column) => (
                <div key={column.key} className="grid gap-2 rounded-lg border border-border bg-[#fbfcfd] p-3 md:grid-cols-[minmax(0,1fr)_180px_120px_32px] md:items-center">
                  <Input
                    value={column.name}
                    onChange={(event) => updateColumn(column.key, { name: event.target.value })}
                    placeholder="level"
                    disabled={creating}
                    aria-label="字段名"
                  />
                  <select
                    className="h-8 rounded-lg border border-border bg-white px-2 text-sm outline-none focus-visible:border-[#9297a0] focus-visible:ring-2 focus-visible:ring-[#9297a0]/20"
                    value={column.type}
                    onChange={(event) => updateColumn(column.key, { type: event.target.value })}
                    disabled={creating}
                    aria-label="字段类型"
                  >
                    {columnTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <label className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={column.nullable}
                      onChange={(event) => updateColumn(column.key, { nullable: event.target.checked })}
                      disabled={creating}
                    />
                    可为空
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeColumn(column.key)}
                    disabled={creating || formColumns.length <= 1}
                    aria-label="删除字段"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {createError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {createError}
              </div>
            )}
            {createdTable && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                已创建 {createdTable.schema_name}.{createdTable.table_name}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => void createTable()} disabled={creating || !tableName.trim()}>
                {creating ? '创建中...' : '创建数据表'}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#181d26]">
              <Terminal className="h-4 w-4" />
              SQL 执行
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              在当前 App schema 中执行 SQL；写操作会保护系统核心表，并限制单条语句 8 秒、最多返回 100 行。
            </p>
          </div>
          <div className="space-y-4 p-4">
            <textarea
              value={sqlText}
              onChange={(event) => setSQLText(event.target.value)}
              className="min-h-36 w-full resize-y rounded-lg border border-border bg-[#fbfcfd] px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-[#9297a0] focus-visible:ring-2 focus-visible:ring-[#9297a0]/20 disabled:pointer-events-none disabled:opacity-50"
              spellCheck={false}
              disabled={executingSQL}
              placeholder={`create table customer_levels (\n  id uuid primary key default gen_random_uuid(),\n  name text not null\n);`}
            />

            {sqlError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {sqlError}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                禁止 `COPY`、`DO`、`GRANT`、`SET ROLE` 等高危操作；`users`、`messages`、`channels` 等系统表不可写。
              </div>
              <Button onClick={() => void executeSQL()} disabled={executingSQL || !sqlText.trim()}>
                {executingSQL ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {executingSQL ? '执行中...' : '执行 SQL'}
              </Button>
            </div>

            {sqlResult && (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  已在 {sqlResult.schema_name} 执行 {sqlResult.statement_count} 条语句。
                </div>
                {sqlResult.results.map((result, index) => (
                  <div key={`${index}:${result.command_tag}`} className="rounded-lg border border-border">
                    <div className="flex flex-col gap-2 border-b border-border bg-[#fbfcfd] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-[#181d26] line-clamp-2">{result.statement}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="font-normal">{result.command_tag || 'OK'}</Badge>
                          <span>{result.duration_ms} ms</span>
                          <span>影响 {result.rows_affected} 行</span>
                          {result.truncated && <span>结果已截断</span>}
                        </div>
                      </div>
                    </div>
                    {result.columns && result.columns.length > 0 ? (
                      <div className="overflow-x-auto p-3">
                        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
                          <thead>
                            <tr className="text-left text-xs font-medium text-muted-foreground">
                              {result.columns.map((column) => (
                                <th key={column} className="border-b border-border px-3 py-2">{column}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(result.rows ?? []).map((row, rowIndex) => (
                              <tr key={rowIndex} className="text-[#181d26]">
                                {result.columns!.map((column) => (
                                  <td key={column} className="max-w-[360px] border-b border-border px-3 py-2 align-top font-mono text-xs">
                                    <span className="line-clamp-3 whitespace-pre-wrap break-words">{renderSQLValue(row[column])}</span>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.row_count === 0 && (
                          <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">无返回行。</div>
                        )}
                      </div>
                    ) : (
                      <div className="px-3 py-3 text-sm text-muted-foreground">语句执行完成，无结果集。</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#181d26]">
              <Table2 className="h-4 w-4" />
              对象明细
            </div>
            <p className="mt-1 text-xs text-muted-foreground">按对象大小排序，索引大小已包含在所属表的总量中。</p>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                加载数据库用量...
              </div>
            ) : usage && !usage.schema_exists ? (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                <Database className="mr-2 h-4 w-4" />
                当前 App 数据库 schema 尚未初始化。
              </div>
            ) : objects.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-muted-foreground">
                      <th className="border-b border-border px-3 py-2">对象</th>
                      <th className="border-b border-border px-3 py-2">类型</th>
                      <th className="border-b border-border px-3 py-2">占用</th>
                      <th className="border-b border-border px-3 py-2">表数据</th>
                      <th className="border-b border-border px-3 py-2">索引</th>
                      <th className="border-b border-border px-3 py-2">计量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((object) => (
                      <tr key={`${object.type}:${object.name}`} className="text-[#181d26]">
                        <td className="border-b border-border px-3 py-2 align-top">
                          <div className="font-mono text-sm">{object.name}</div>
                          {object.parent_table && <div className="mt-1 text-xs text-muted-foreground">属于 {object.parent_table}</div>}
                        </td>
                        <td className="border-b border-border px-3 py-2 align-top">
                          <Badge variant="outline" className="font-normal">{objectTypeLabel(object.type)}</Badge>
                        </td>
                        <td className="border-b border-border px-3 py-2 align-top font-mono">{object.pretty_size || formatBytes(object.total_bytes)}</td>
                        <td className="border-b border-border px-3 py-2 align-top font-mono text-xs text-muted-foreground">{formatBytes(object.table_bytes)}</td>
                        <td className="border-b border-border px-3 py-2 align-top font-mono text-xs text-muted-foreground">{formatBytes(object.index_bytes)}</td>
                        <td className="border-b border-border px-3 py-2 align-top">
                          <Badge variant={object.counted_in_total ? 'secondary' : 'outline'} className="font-normal">
                            {object.counted_in_total ? '计入总量' : '已随表计入'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                <HardDrive className="mr-2 h-4 w-4" />
                暂无数据库对象。
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
