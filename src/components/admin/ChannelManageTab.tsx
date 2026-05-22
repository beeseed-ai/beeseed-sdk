import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Check, Copy, MessageSquare, RefreshCw, RotateCcw, Search, Trash2, UserPlus, Users, X } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Badge } from '../ui/badge.js'
import type { AppUser, ChannelMemberInfo, ChannelWithMeta } from '../../core/types.js'

interface AdminChannel extends ChannelWithMeta {
  user_count?: number
  agent_count?: number
  message_count?: number
}

interface AgentTemplateOption {
  id: string
  name: string
  role?: string
  version?: string
  avatar_url?: string
  avatar_preset?: string
}

interface ChannelDetail {
  channel: AdminChannel
  members: ChannelMemberInfo[]
  available_agents: AgentTemplateOption[]
}

function parseSettings(settings?: string): Record<string, unknown> {
  if (!settings) return {}
  try {
    const parsed = JSON.parse(settings)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function channelName(channel: AdminChannel | null | undefined) {
  return channel?.name?.trim() || '未命名频道'
}

function formatDate(value?: string | null) {
  if (!value) return '无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '无'
  return date.toLocaleString()
}

function shortID(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value
}

function memberName(member: ChannelMemberInfo) {
  return member.display_name || member.nickname || member.agent_id || member.user_id || '成员'
}

function roleLabel(role: string) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return '管理员'
  return '成员'
}

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'owner') return 'default'
  if (role === 'admin') return 'secondary'
  return 'outline'
}

function channelIssues(channel: AdminChannel) {
  const issues: string[] = []
  if (channel.deleted_at) issues.push('已删除')
  if ((channel.user_count ?? 0) === 0) issues.push('无用户')
  if ((channel.agent_count ?? 0) === 0) issues.push('无 Agent')
  if (!channel.owner_email && !channel.owner_name) issues.push('无创建者')
  if (channel.archived_at || parseSettings(channel.settings).archived === true) issues.push('已归档')
  return issues
}

export function ChannelManageTab() {
  const { api, channelsStore } = useBeeSeedContext()
  const { setActiveFeature } = useDetailPanel()
  const [channels, setChannels] = useState<AdminChannel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ChannelDetail | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [addUserId, setAddUserId] = useState('')
  const [addAgentId, setAddAgentId] = useState('')
  const [error, setError] = useState('')

  const loadChannels = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('admin/channels').json<AdminChannel[]>()
      setChannels(data)
      setSelectedId((current) => current ?? data[0]?.id ?? null)
    } catch {
      setError('频道列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [api])

  const loadDetail = useCallback(async (channelId: string) => {
    setDetailLoading(true)
    setError('')
    try {
      const data = await api.get(`admin/channels/${channelId}`).json<ChannelDetail>()
      setDetail(data)
      setNameDraft(data.channel.name ?? '')
      setAddUserId('')
      setAddAgentId('')
    } catch {
      setError('频道详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }, [api])

  useEffect(() => { void loadChannels() }, [loadChannels])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    void loadDetail(selectedId)
  }, [loadDetail, selectedId])

  useEffect(() => {
    api.get('admin/users', { searchParams: { limit: '200' } })
      .json<{ items: AppUser[] }>()
      .then((data) => setUsers(data.items ?? []))
      .catch(() => setUsers([]))
  }, [api])

  const filteredChannels = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return channels
    return channels.filter((channel) => {
      const haystack = [
        channel.name,
        channel.id,
        channel.owner_name,
        channel.owner_email,
        channel.last_message,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [channels, query])

  const selectedChannel = detail?.channel ?? channels.find((channel) => channel.id === selectedId) ?? null
  const members = detail?.members ?? []
  const userMembers = members.filter((member) => member.member_type === 'user')
  const agentMembers = members.filter((member) => member.member_type === 'agent')
  const memberUserIds = new Set(userMembers.map((member) => member.user_id).filter(Boolean))
  const memberAgentIds = new Set(agentMembers.map((member) => member.agent_id).filter(Boolean))
  const availableUsers = users.filter((user) => !memberUserIds.has(user.id) && !user.is_disabled)
  const availableAgents = (detail?.available_agents ?? []).filter((agent) => !memberAgentIds.has(agent.id))
  const selectedArchived = selectedChannel ? Boolean(selectedChannel.archived_at || parseSettings(selectedChannel.settings).archived === true) : false
  const selectedDeleted = Boolean(selectedChannel?.deleted_at)
  const selectedIssues = selectedChannel ? channelIssues(selectedChannel) : []

  async function refreshAll(channelId = selectedId) {
    await loadChannels()
    if (channelId) await loadDetail(channelId)
    void channelsStore.getState().fetchChannels()
  }

  async function saveChannel() {
    if (!selectedChannel) return
    const cleanName = nameDraft.trim()
    if (!cleanName) {
      setError('频道名称不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.patch(`admin/channels/${selectedChannel.id}`, {
        json: { name: cleanName },
      })
      await refreshAll(selectedChannel.id)
    } catch {
      setError('频道保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function setArchived(archived: boolean) {
    if (!selectedChannel) return
    setSaving(true)
    setError('')
    try {
      await api.patch(`admin/channels/${selectedChannel.id}`, { json: { archived } })
      await refreshAll(selectedChannel.id)
    } catch {
      setError('归档状态更新失败')
    } finally {
      setSaving(false)
    }
  }

  async function deleteChannel() {
    if (!selectedChannel) return
    const label = channelName(selectedChannel)
    if (!window.confirm(`删除频道实例「${label}」？频道会从用户列表隐藏，消息和成员记录保留，可在管理后台恢复。`)) return
    setSaving(true)
    setError('')
    try {
      await api.delete(`admin/channels/${selectedChannel.id}`, { json: { reason: 'admin_delete' } })
      await refreshAll(selectedChannel.id)
    } catch {
      setError('删除频道失败')
    } finally {
      setSaving(false)
    }
  }

  async function restoreChannel() {
    if (!selectedChannel) return
    setSaving(true)
    setError('')
    try {
      await api.post(`admin/channels/${selectedChannel.id}/restore`)
      await refreshAll(selectedChannel.id)
    } catch {
      setError('恢复频道失败')
    } finally {
      setSaving(false)
    }
  }

  async function addMembers() {
    if (!selectedChannel || (!addUserId && !addAgentId)) return
    setSaving(true)
    setError('')
    try {
      await api.post(`admin/channels/${selectedChannel.id}/members`, {
        json: {
          user_ids: addUserId ? [addUserId] : [],
          agent_ids: addAgentId ? [addAgentId] : [],
        },
      }).json<ChannelMemberInfo[]>()
      await refreshAll(selectedChannel.id)
    } catch {
      setError('添加成员失败')
    } finally {
      setSaving(false)
    }
  }

  async function updateUserRole(userId: string, role: string) {
    if (!selectedChannel) return
    setSaving(true)
    setError('')
    try {
      await api.patch(`admin/channels/${selectedChannel.id}/members/users/${encodeURIComponent(userId)}`, { json: { role } })
      await refreshAll(selectedChannel.id)
    } catch {
      setError('成员角色更新失败')
    } finally {
      setSaving(false)
    }
  }

  async function updateAgentCoordinator(agentId: string, isCoordinator: boolean) {
    if (!selectedChannel) return
    setSaving(true)
    setError('')
    try {
      await api.patch(`admin/channels/${selectedChannel.id}/members/agents/${encodeURIComponent(agentId)}`, {
        json: { role: 'member', is_coordinator: isCoordinator },
      })
      await refreshAll(selectedChannel.id)
    } catch {
      setError('Agent 状态更新失败')
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(member: ChannelMemberInfo) {
    if (!selectedChannel) return
    const id = member.member_type === 'agent' ? member.agent_id : member.user_id
    if (!id) return
    setSaving(true)
    setError('')
    const kind = member.member_type === 'agent' ? 'agents' : 'users'
    try {
      await api.delete(`admin/channels/${selectedChannel.id}/members/${kind}/${encodeURIComponent(id)}`)
      await refreshAll(selectedChannel.id)
    } catch {
      setError(member.member_type === 'agent' ? '移除 Agent 失败' : '移除用户失败')
    } finally {
      setSaving(false)
    }
  }

  async function copyChannelId() {
    if (!selectedChannel) return
    try {
      await navigator.clipboard.writeText(selectedChannel.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('复制失败')
    }
  }

  function openChannel() {
    if (!selectedChannel) return
    channelsStore.getState().setCurrentChannel(selectedChannel.id)
    setActiveFeature('chat')
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#1a1a1a]">频道管理</h1>
              <p className="mt-1 text-sm text-muted-foreground">查看频道运行状态，维护成员、Agent 和基础配置。</p>
            </div>
            <Button variant="outline" onClick={() => void refreshAll()} disabled={loading || detailLoading}>
              <RefreshCw className={cn('h-4 w-4', (loading || detailLoading) && 'animate-spin')} />
              刷新
            </Button>
          </div>
          {error && (
            <div className="mt-3 rounded-lg border border-[#aa2d00]/25 bg-[#fff4ef] px-3 py-2 text-sm text-[#aa2d00]">
              {error}
            </div>
          )}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,0.92fr)_minmax(420px,1.08fr)]">
          <section className="min-h-0 border-r border-border bg-white">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索频道、创建者或 ID"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="h-full overflow-y-auto pb-20">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">加载频道...</div>
              ) : filteredChannels.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">暂无匹配频道</div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredChannels.map((channel) => {
                    const active = channel.id === selectedId
                    const issues = channelIssues(channel)
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setSelectedId(channel.id)}
                        className={cn(
                          'flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-[#f8fafc]',
                          active && 'bg-[#f2f4f7]',
                        )}
                      >
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium text-[#181d26]">{channelName(channel)}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{shortID(channel.id)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{channel.user_count ?? 0} 用户</span>
                          <span>{channel.agent_count ?? 0} Agent</span>
                          <span>{channel.message_count ?? 0} 消息</span>
                        </div>
                        {channel.last_message && (
                          <p className="truncate text-xs text-[#555]">{channel.last_message}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {issues.length === 0 ? (
                            <Badge variant="success" className="text-[10px] font-normal">正常</Badge>
                          ) : issues.map((issue) => (
                            <Badge key={issue} variant={issue === '已归档' || issue === '已删除' ? 'secondary' : 'warning'} className="text-[10px] font-normal">
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto">
            {!selectedChannel ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">选择一个频道查看详情</div>
            ) : detailLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载详情...</div>
            ) : (
              <div className="space-y-5 p-6">
                <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <h2 className="min-w-0 truncate text-lg font-semibold text-[#181d26]">{channelName(selectedChannel)}</h2>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>创建者：{selectedChannel.owner_name || selectedChannel.owner_email || '未知'}</span>
                        <span>更新：{formatDate(selectedChannel.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => void copyChannelId()}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? '已复制' : '复制 ID'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={openChannel} disabled={selectedDeleted}>进入频道</Button>
                    </div>
                  </div>
                  {selectedIssues.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedIssues.map((issue) => (
                        <Badge key={issue} variant={issue === '已归档' || issue === '已删除' ? 'secondary' : 'warning'} className="font-normal">{issue}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Metric label="用户" value={userMembers.length} />
                    <Metric label="Agent" value={agentMembers.length} />
                    <Metric label="消息" value={selectedChannel.message_count ?? 0} />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#181d26]">基础设置</h3>
                    <Button size="sm" onClick={() => void saveChannel()} disabled={saving || selectedDeleted}>
                      {saving ? '保存中...' : '保存'}
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#555]">频道名称</label>
                      <Input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} disabled={selectedDeleted} />
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <Button
                        variant={selectedArchived ? 'outline' : 'destructive'}
                        onClick={() => void setArchived(!selectedArchived)}
                        disabled={saving || selectedDeleted}
                      >
                        {selectedArchived ? '取消归档标记' : '标记归档'}
                      </Button>
                      {selectedDeleted ? (
                        <Button variant="outline" onClick={() => void restoreChannel()} disabled={saving}>
                          <RotateCcw className="h-4 w-4" />
                          恢复频道
                        </Button>
                      ) : (
                        <Button variant="destructive" onClick={() => void deleteChannel()} disabled={saving}>
                          <Trash2 className="h-4 w-4" />
                          删除频道
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">归档是管理标记；删除会隐藏频道实例并停止该频道 Agent，可在这里恢复。</p>
                </div>

                <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-[#181d26]">用户成员</h3>
                  </div>
                  <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select
                      value={addUserId}
                      onChange={(event) => setAddUserId(event.target.value)}
                      disabled={selectedDeleted}
                      className="h-8 rounded-lg border border-border bg-white px-2.5 text-sm outline-none focus:border-[#9297a0] disabled:cursor-not-allowed disabled:bg-muted"
                    >
                      <option value="">选择要加入的用户</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
                      ))}
                    </select>
                    <Button variant="outline" onClick={() => void addMembers()} disabled={!addUserId || saving || selectedDeleted}>
                      <UserPlus className="h-4 w-4" />
                      添加用户
                    </Button>
                  </div>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {userMembers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">暂无用户成员</div>
                    ) : userMembers.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        onRoleChange={(role) => member.user_id && void updateUserRole(member.user_id, role)}
                        onRemove={() => void removeMember(member)}
                        saving={saving || selectedDeleted}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-[#181d26]">频道 Agent</h3>
                  </div>
                  <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select
                      value={addAgentId}
                      onChange={(event) => setAddAgentId(event.target.value)}
                      disabled={selectedDeleted}
                      className="h-8 rounded-lg border border-border bg-white px-2.5 text-sm outline-none focus:border-[#9297a0] disabled:cursor-not-allowed disabled:bg-muted"
                    >
                      <option value="">选择要加入的 Agent</option>
                      {availableAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name || agent.id} · {agent.id}</option>
                      ))}
                    </select>
                    <Button variant="outline" onClick={() => void addMembers()} disabled={!addAgentId || saving || selectedDeleted}>
                      <Bot className="h-4 w-4" />
                      添加 Agent
                    </Button>
                  </div>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {agentMembers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">暂无 Agent</div>
                    ) : agentMembers.map((member) => (
                      <AgentRow
                        key={member.id}
                        member={member}
                        onCoordinatorChange={(checked) => member.agent_id && void updateAgentCoordinator(member.agent_id, checked)}
                        onRemove={() => void removeMember(member)}
                        saving={saving || selectedDeleted}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-[#f8fafc] px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#181d26]">{value}</div>
    </div>
  )
}

function MemberRow({ member, saving, onRoleChange, onRemove }: {
  member: ChannelMemberInfo
  saving: boolean
  onRoleChange: (role: string) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[#181d26]">{memberName(member)}</span>
          <Badge variant={roleBadgeVariant(member.role)} className="text-[10px] font-normal">{roleLabel(member.role)}</Badge>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{member.user_id}</div>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={member.role}
          onChange={(event) => onRoleChange(event.target.value)}
          disabled={saving}
          className="h-7 rounded-md border border-border bg-white px-2 text-xs outline-none focus:border-[#9297a0]"
        >
          <option value="owner">Owner</option>
          <option value="admin">管理员</option>
          <option value="member">成员</option>
        </select>
        <Button variant="ghost" size="icon-sm" onClick={onRemove} disabled={saving} title="移除成员">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  )
}

function AgentRow({ member, saving, onCoordinatorChange, onRemove }: {
  member: ChannelMemberInfo
  saving: boolean
  onCoordinatorChange: (checked: boolean) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[#181d26]">{memberName(member)}</span>
          {member.is_coordinator && <Badge variant="secondary" className="text-[10px] font-normal">协调者</Badge>}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{member.agent_id}</div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-[#555]">
          <input
            type="checkbox"
            checked={member.is_coordinator}
            onChange={(event) => onCoordinatorChange(event.target.checked)}
            disabled={saving}
            className="h-4 w-4 rounded border-border"
          />
          协调者
        </label>
        <Button variant="ghost" size="icon-sm" onClick={onRemove} disabled={saving} title="移除 Agent">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  )
}
