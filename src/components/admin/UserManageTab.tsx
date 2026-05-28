import { useEffect, useMemo, useState } from 'react'
import { Ban, Check, ChevronLeft, ChevronRight, Copy, Info, LockKeyhole, Plus, ShieldCheck, Trash2, UserCheck, UserX, X } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useAppUsers } from '../../hooks/use-app-users.js'
import { useInvites } from '../../hooks/use-invites.js'
import { useAppSettings } from '../../hooks/use-app-settings.js'
import { Button } from '../ui/button.js'
import { Badge } from '../ui/badge.js'
import type { AppMembershipStatus, AppRole, ApplicationJoinMode, AppUser, Invite } from '../../core/types.js'

export function UserManageTab() {
  const { user: currentUser } = useAuth()
  const currentRole = (currentUser?.role || 'member') as AppRole

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <div>
            <h1 className="text-xl font-semibold tracking-normal text-[#1a1a1a]">访问与成员</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              App 后台只管理当前 App 的加入方式、邀请和成员使用状态。App 管理员委派、组织可见范围和平台级用户禁用在 Hive 平台的 App 管理中完成。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <JoinPolicySection currentRole={currentRole} />
            <InviteCodesSection currentRole={currentRole} />
          </div>

          <UserListSection
            currentRole={currentRole}
            currentUserId={currentUser?.id}
            currentAppUserId={currentUser?.app_user_id}
          />
        </div>
      </div>
    </div>
  )
}

function JoinPolicySection({ currentRole }: { currentRole: AppRole }) {
  const { accessPolicy, joinMode, setJoinMode, loading } = useAppSettings()
  const canManage = currentRole === 'owner' || currentRole === 'admin'

  const policies: { value: ApplicationJoinMode; label: string; desc: string }[] = [
    { value: 'auto', label: '公开加入', desc: '已登录 Hive 用户访问后自动成为 App 成员' },
    { value: 'invite', label: '邀请加入', desc: '用户需要有效加入邀请才能成为 App 成员' },
    { value: 'closed', label: '关闭新成员', desc: '已有成员可继续使用，新用户不能加入此 App' },
  ]

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1a1a1a]">新成员加入方式</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">这里不创建 App 账号，只控制 Hive 用户何时形成 App 成员关系。</p>
        </div>
        <LockKeyhole className="mt-0.5 h-4 w-4 text-muted-foreground" />
      </div>

      {accessPolicy && accessPolicy.entry_mode !== 'public' && (
        <div className="mb-3 flex gap-2 rounded-lg border border-[#d9dee7] bg-[#f8fafc] p-3 text-xs leading-5 text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>入口范围由 Hive 平台控制：{entryModeLabel(accessPolicy.entry_mode)}。本页只调整首次加入方式。</span>
        </div>
      )}

      <div className="space-y-3">
        {policies.map((p) => (
          <label
            key={p.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
              joinMode === p.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted',
              (!canManage || loading) && 'pointer-events-none cursor-not-allowed opacity-60',
            )}
          >
            <div className="flex h-5 items-center">
              <input
                type="radio"
                name="join_mode"
                value={p.value}
                checked={joinMode === p.value}
                onChange={() => setJoinMode(p.value)}
                className="h-4 w-4 border-primary text-primary"
                disabled={!canManage || loading}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[#1a1a1a]">{p.label}</span>
              <span className="text-xs leading-5 text-muted-foreground">{p.desc}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

function InviteCodesSection({ currentRole }: { currentRole: AppRole }) {
  const { invites, createInvite, revokeInvite, loading } = useInvites()
  const { joinMode } = useAppSettings()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const canManage = currentRole === 'owner' || currentRole === 'admin'
  const inviteMode = joinMode === 'invite'

  const handleCopy = (code: string | undefined, id: string) => {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex h-[280px] flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1a1a1a]">加入邀请</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">邀请只用于加入当前 App，不用于注册独立 App 账号。</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => createInvite()} disabled={loading || !inviteMode} title={inviteMode ? '生成加入邀请' : '需要先切换到邀请加入'}>
            <Plus className="h-3.5 w-3.5" />
            生成邀请
          </Button>
        )}
      </div>

      {!inviteMode && (
        <div className="mb-3 rounded-lg border border-[#d9dee7] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-muted-foreground">
          当前不是邀请加入模式；已有邀请保留，但新用户不会因为公开访问被要求填写加入邀请。
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto pr-2">
        {invites.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            暂无加入邀请
          </div>
        ) : (
          invites.map((invite: Invite) => {
            const isRevoked = !!invite.revoked_at
            const isUsed = !!invite.used_at
            const inactive = isRevoked || isUsed
            const display = invite.code ?? `${invite.token_prefix}••••`
            return (
              <div key={invite.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className={cn('truncate font-mono font-medium', inactive ? 'text-muted-foreground line-through' : 'text-[#1a1a1a]')}>
                    {display}
                  </span>
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {isUsed ? '已加入使用' : isRevoked ? '已撤销' : invite.expires_at ? `有效至 ${new Date(invite.expires_at).toLocaleDateString()}` : '长期有效'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!inactive && invite.code && (
                    <Button variant="ghost" size="icon-sm" onClick={() => handleCopy(invite.code, invite.id)} title="复制加入邀请">
                      {copiedId === invite.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                  )}
                  {canManage && !inactive && (
                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => revokeInvite(invite.id)} title="撤销加入邀请">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function UserListSection({
  currentRole,
  currentUserId,
  currentAppUserId,
}: {
  currentRole: AppRole
  currentUserId?: string
  currentAppUserId?: string
}) {
  const {
    users,
    blockedUsers,
    blockedTotal,
    loading,
    blockedLoading,
    error,
    fetchBlockedUsers,
    toggleDisabled,
    removeUser,
    blockUser,
    unblockUser,
  } = useAppUsers()
  const [view, setView] = useState<'members' | 'blocked'>('members')
  const [blockedPage, setBlockedPage] = useState(0)
  const pageSize = 10

  useEffect(() => {
    if (view === 'blocked') {
      void fetchBlockedUsers({ limit: pageSize, offset: blockedPage * pageSize })
    }
  }, [blockedPage, fetchBlockedUsers, view])

  const sortedUsers = useMemo(() => {
    return users.filter(isVisibleMember).sort((a, b) => {
      const roleWeight: Record<AppRole, number> = { owner: 0, admin: 1, member: 2 }
      if (roleWeight[a.role] !== roleWeight[b.role]) {
        return roleWeight[a.role] - roleWeight[b.role]
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [users])

  const canManageUser = (targetRole: AppRole, isSelf: boolean) => {
    if (isSelf) return false
    if (currentRole === 'owner') return targetRole !== 'owner'
    if (currentRole === 'admin') return targetRole === 'member'
    return false
  }

  const handleRemove = async (user: AppUser) => {
    if (!window.confirm(`从当前 App 移除「${user.name}」？对方之后仍可按加入策略重新加入。`)) return
    await removeUser(user.id)
  }

  const handleBlock = async (user: AppUser) => {
    if (!window.confirm(`拉黑「${user.name}」？对方会从成员列表移除，并且解除拉黑前不能再次加入此 App。`)) return
    await blockUser(user.id)
  }

  const handleUnblock = async (appUserId: string, name: string) => {
    if (!window.confirm(`解除「${name}」的拉黑？解除后不会自动恢复为成员，需要按当前加入方式重新进入。`)) return
    await unblockUser(appUserId)
    await fetchBlockedUsers({ limit: pageSize, offset: blockedPage * pageSize })
  }

  const blockedPageCount = Math.max(1, Math.ceil(blockedTotal / pageSize))
  const canManageAny = currentRole === 'owner' || currentRole === 'admin'

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1a1a1a]">App 成员</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">禁止使用是可恢复的 App 状态；移除会解除成员关系；拉黑会阻止再次加入。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-[#f8fafc] p-0.5">
              <button
                type="button"
                onClick={() => setView('members')}
                className={cn('h-7 rounded-md px-3 text-xs font-medium transition-colors', view === 'members' ? 'bg-white text-[#181d26] shadow-sm' : 'text-muted-foreground hover:text-[#181d26]')}
              >
                成员 {sortedUsers.length}
              </button>
              <button
                type="button"
                onClick={() => setView('blocked')}
                className={cn('h-7 rounded-md px-3 text-xs font-medium transition-colors', view === 'blocked' ? 'bg-white text-[#181d26] shadow-sm' : 'text-muted-foreground hover:text-[#181d26]')}
              >
                拉黑名单 {blockedTotal}
              </button>
            </div>
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <ShieldCheck className="h-3.5 w-3.5" />
              管理员委派在 Hive 平台
            </Badge>
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {view === 'members' ? (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#fafafa] text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">成员</th>
              <th className="px-5 py-3 font-medium">App 角色</th>
              <th className="px-5 py-3 font-medium">App 状态</th>
              <th className="px-5 py-3 font-medium">加入时间</th>
              <th className="px-5 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">加载中...</td></tr>
            ) : sortedUsers.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">暂无 App 成员。Hive 用户首次进入此 App 后会出现在这里。</td></tr>
            ) : (
              sortedUsers.map((user: AppUser) => {
                const isSelf = user.id === currentUserId || (!!currentAppUserId && user.app_user_id === currentAppUserId)
                const isManageable = canManageUser(user.role, isSelf)
                const status = memberStatusMeta(user.app_membership_status, user.is_disabled)
                const disabled = status.status === 'disabled'
                const canRestore = disabled && (user.role === 'admin' ? currentRole === 'owner' : isManageable)

                return (
                  <tr key={user.id} className="transition-colors hover:bg-[#fafafa]/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-2 font-medium text-[#1a1a1a]">
                            <span className="truncate">{user.name}</span>
                            {isSelf && <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px] font-normal">你</Badge>}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={user.role === 'owner' ? 'default' : user.role === 'admin' ? 'secondary' : 'outline'} className="text-xs font-normal">
                        {roleLabel(user.role)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={status.variant} className="text-xs font-normal">{status.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {disabled ? (
                          canRestore ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleDisabled(user.id, false)}
                              className="h-7 px-2 text-xs text-green-700 hover:bg-green-50"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              恢复使用
                            </Button>
                          ) : !isSelf && (
                            <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs opacity-50" title="权限不足">恢复使用</Button>
                          )
                        ) : isManageable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleDisabled(user.id, true)}
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            禁止使用
                          </Button>
                        ) : !isSelf && user.role !== 'owner' && (
                          <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs opacity-50" title="权限不足">禁止使用</Button>
                        )}
                        {isManageable && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemove(user)}
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-[#181d26]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              移除
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleBlock(user)}
                              className="h-7 px-2 text-xs"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              拉黑
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#fafafa] text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">用户</th>
                <th className="px-5 py-3 font-medium">原因</th>
                <th className="px-5 py-3 font-medium">拉黑时间</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {blockedLoading ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">加载中...</td></tr>
              ) : blockedUsers.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">暂无拉黑用户。</td></tr>
              ) : (
                blockedUsers.map((item) => {
                  const name = item.user_name || item.user_email || '未知用户'
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[#fafafa]/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {item.user_avatar ? (
                            <img src={item.user_avatar} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1f3f5] font-medium text-muted-foreground">
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium text-[#1a1a1a]">{name}</span>
                            <span className="truncate text-xs text-muted-foreground">{item.user_email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[280px] px-5 py-3 text-muted-foreground">
                        <span className="line-clamp-2">{item.reason || '未填写'}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                        {new Date(item.blocked_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canManageAny && item.app_user_id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnblock(item.app_user_id!, name)}
                            className="h-7 px-2 text-xs"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            解除拉黑
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs opacity-50" title="权限不足">解除拉黑</Button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>第 {blockedPage + 1} / {blockedPageCount} 页</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={blockedPage <= 0 || blockedLoading}
                onClick={() => setBlockedPage(page => Math.max(0, page - 1))}
                title="上一页"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={blockedPage + 1 >= blockedPageCount || blockedLoading}
                onClick={() => setBlockedPage(page => Math.min(blockedPageCount - 1, page + 1))}
                title="下一页"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function entryModeLabel(mode: string) {
  switch (mode) {
    case 'org_only':
      return '仅组织成员可进入'
    case 'invite_only':
      return '仅邀请成员可进入'
    case 'closed':
      return '入口已关闭'
    default:
      return '公开入口'
  }
}

function isVisibleMember(user: AppUser) {
  return user.app_membership_status !== 'left'
}

function roleLabel(role: AppRole) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  return 'Member'
}

function memberStatusMeta(status: AppMembershipStatus | undefined, disabled: boolean): { status: AppMembershipStatus; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' } {
  const resolved = disabled ? 'disabled' : status || 'active'
  switch (resolved) {
    case 'disabled':
      return { status: resolved, label: '禁止使用此 App', variant: 'destructive' }
    case 'pending':
      return { status: resolved, label: '待审核', variant: 'secondary' }
    case 'left':
      return { status: resolved, label: '已退出', variant: 'outline' }
    default:
      return { status: 'active', label: '正常', variant: 'success' }
  }
}
