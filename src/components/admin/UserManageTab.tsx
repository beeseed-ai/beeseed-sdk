import { useState, useMemo } from 'react'
import { Plus, Check, X, Copy } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useAppUsers } from '../../hooks/use-app-users.js'
import { useInvites } from '../../hooks/use-invites.js'
import { useAppSettings } from '../../hooks/use-app-settings.js'
import { Button } from '../ui/button.js'
import { Badge } from '../ui/badge.js'
import type { AppRole, RegistrationPolicy, AppUser, Invite } from '../../core/types.js'

export function UserManageTab() {
  const { user: currentUser } = useAuth()
  const currentRole = (currentUser?.role || 'member') as AppRole

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#1a1a1a]">用户与访问控制</h1>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <RegistrationPolicySection currentRole={currentRole} />
            <InviteCodesSection currentRole={currentRole} />
          </div>

          <UserListSection currentRole={currentRole} currentUserId={currentUser?.id} />
        </div>
      </div>
    </div>
  )
}

function RegistrationPolicySection({ currentRole }: { currentRole: AppRole }) {
  const { registrationPolicy, setRegistrationPolicy, loading } = useAppSettings()
  const canManage = currentRole === 'owner' || currentRole === 'admin'

  const policies: { value: RegistrationPolicy; label: string; desc: string }[] = [
    { value: 'open', label: '开放注册', desc: '任何人可注册' },
    { value: 'invite', label: '仅限邀请', desc: '需有效邀请码' },
    { value: 'closed', label: '关闭注册', desc: '不允许新用户注册' }
  ]

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-[#1a1a1a]">注册策略</h3>
      <div className="space-y-3">
        {policies.map((p) => (
          <label
            key={p.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              registrationPolicy === p.value
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted",
              (!canManage || loading) && "opacity-60 cursor-not-allowed pointer-events-none"
            )}
          >
            <div className="flex h-5 items-center">
              <input
                type="radio"
                name="registration_policy"
                value={p.value}
                checked={registrationPolicy === p.value}
                onChange={() => setRegistrationPolicy(p.value)}
                className="h-4 w-4 border-primary text-primary"
                disabled={!canManage || loading}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[#1a1a1a]">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.desc}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

function InviteCodesSection({ currentRole }: { currentRole: AppRole }) {
  const { invites, createInvite, revokeInvite, loading } = useInvites()
  const { registrationPolicy } = useAppSettings()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const canManage = currentRole === 'owner' || currentRole === 'admin'

  const handleCopy = (code: string | undefined, id: string) => {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (registrationPolicy !== 'invite' && !canManage) {
    return (
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm opacity-50 flex items-center justify-center">
        <span className="text-sm text-muted-foreground">邀请码功能仅在"仅限邀请"策略下可用</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm flex flex-col h-[280px]">
      <div className="mb-4 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">邀请码管理</h3>
        {canManage && (
          <Button size="sm" onClick={() => createInvite()} disabled={loading}>
            <Plus className="w-3.5 h-3.5" />
            生成邀请码
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {invites.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            暂无邀请码
          </div>
        ) : (
          invites.map((invite: Invite) => {
            const isRevoked = !!invite.revoked_at
            const isUsed = !!invite.used_at
            const inactive = isRevoked || isUsed
            const display = invite.code ?? `${invite.token_prefix}••••`
            return (
              <div key={invite.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-col">
                  <span className={cn("font-medium font-mono", inactive ? "line-through text-muted-foreground" : "text-[#1a1a1a]")}>
                    {display}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {isUsed ? '已使用' : isRevoked ? '已撤销' : invite.expires_at ? `有效至 ${new Date(invite.expires_at).toLocaleDateString()}` : '长期有效'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!inactive && invite.code && (
                    <Button variant="ghost" size="icon-sm" onClick={() => handleCopy(invite.code, invite.id)} title="复制邀请码">
                      {copiedId === invite.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    </Button>
                  )}
                  {canManage && !inactive && (
                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => revokeInvite(invite.id)} title="撤销邀请码">
                      <X className="w-3.5 h-3.5" />
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

function UserListSection({ currentRole, currentUserId }: { currentRole: AppRole, currentUserId?: string }) {
  const { users, loading, changeRole, toggleDisabled } = useAppUsers()

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const roleWeight: Record<AppRole, number> = { owner: 0, admin: 1, member: 2 }
      if (roleWeight[a.role] !== roleWeight[b.role]) {
        return roleWeight[a.role] - roleWeight[b.role]
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [users])

  const canManageUser = (targetRole: AppRole, isSelf: boolean) => {
    if (isSelf) return false // can't manage self through this UI
    if (currentRole === 'owner') return true
    if (currentRole === 'admin') return targetRole !== 'owner' && targetRole !== 'admin'
    return false
  }

  const canChangeRole = (isSelf: boolean) => {
    if (isSelf) return false
    return currentRole === 'owner' // only owner can change roles
  }

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">App 用户 ({users.length})</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#fafafa] text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">用户</th>
              <th className="px-5 py-3 font-medium">角色</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">加入时间</th>
              <th className="px-5 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">加载中...</td></tr>
            ) : sortedUsers.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">暂无用户</td></tr>
            ) : (
              sortedUsers.map((user: AppUser) => {
                const isSelf = user.id === currentUserId
                const isManageable = canManageUser(user.role, isSelf)
                const isRoleChangeable = canChangeRole(isSelf)

                // Hide unban button for banned admins if viewer is not owner
                const canUnban = user.is_disabled ? (user.role === 'admin' ? currentRole === 'owner' : isManageable) : isManageable

                return (
                  <tr key={user.id} className="hover:bg-[#fafafa]/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium text-[#1a1a1a] flex items-center gap-2">
                            {user.name} {isSelf && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">你</Badge>}
                          </span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={user.role === 'owner' ? 'default' : user.role === 'admin' ? 'secondary' : 'outline'} className="capitalize font-normal text-xs">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {user.is_disabled ? (
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-transparent font-normal text-xs">已禁用</Badge>
                      ) : (
                        <Badge variant="success" className="font-normal text-xs">正常</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isRoleChangeable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => changeRole(user.id, user.role === 'admin' ? 'member' : 'admin')}
                            className="text-xs h-7 px-2 text-muted-foreground hover:text-[#1a1a1a]"
                          >
                            {user.role === 'admin' ? '降为成员' : '设为管理员'}
                          </Button>
                        )}

                        {user.is_disabled ? (
                          canUnban ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleDisabled(user.id, false)}
                              className="text-xs h-7 px-2 border-green-200 text-green-700 hover:bg-green-50"
                            >
                              解禁
                            </Button>
                          ) : !isSelf && (
                            <Button variant="ghost" size="sm" disabled className="text-xs h-7 px-2 opacity-50" title="权限不足">解禁</Button>
                          )
                        ) : (
                          isManageable ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDisabled(user.id, true)}
                              className="text-xs h-7 px-2 text-destructive hover:bg-destructive/10"
                            >
                              禁用
                            </Button>
                          ) : !isSelf && user.role !== 'owner' && (
                            <Button variant="ghost" size="sm" disabled className="text-xs h-7 px-2 opacity-50" title="权限不足">禁用</Button>
                          )
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
    </div>
  )
}
