import { useState, useEffect, useRef } from 'react'
import { Camera, Copy, Check, Key, LogOut, Mail, User, Shield, X } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { Dialog } from '../ui/dialog.js'
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar.js'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Tab = 'account' | 'security'

export function ProfileModal({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<Tab>('account')

  useEffect(() => {
    if (open) setTab('account')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="relative w-full max-w-[560px] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
        <button onClick={() => onOpenChange(false)} className="absolute top-3 right-3 z-10 p-1 rounded-md hover:bg-black/5 transition-colors">
          <X className="w-4 h-4 text-[#999]" />
        </button>
        <div className="flex h-[480px]">
          {/* Left tabs */}
          <div className="w-[140px] shrink-0 border-r border-[#f0f0f0] p-2 flex flex-col gap-0.5">
            <div className="px-3 py-2 text-sm font-semibold text-[#1a1a1a]">设置</div>
            <button
              onClick={() => setTab('account')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                tab === 'account' ? 'bg-[#f0f0f0] text-[#1a1a1a] font-medium' : 'text-[#555] hover:bg-[#f5f5f5]',
              )}
            >
              <User className="w-4 h-4" />
              账号
            </button>
            <button
              onClick={() => setTab('security')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                tab === 'security' ? 'bg-[#f0f0f0] text-[#1a1a1a] font-medium' : 'text-[#555] hover:bg-[#f5f5f5]',
              )}
            >
              <Key className="w-4 h-4" />
              安全
            </button>
          </div>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'account' ? (
              <AccountTab onClose={() => onOpenChange(false)} />
            ) : (
              <SecurityTab />
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function AccountTab({ onClose }: { onClose: () => void }) {
  const { user, signOut, updateAvatar, updateName } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    if (user) setName(user.name ?? '')
  }, [user])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    await updateAvatar(file)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await updateName(name.trim())
    setSaving(false)
  }

  const handleCopyToken = () => {
    const token = localStorage.getItem('beeseed_token')
    if (token) {
      void navigator.clipboard.writeText(token)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Avatar + basic info */}
      <div className="flex items-center gap-4">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="relative group cursor-pointer shrink-0">
          <Avatar className="size-16 border-2 border-[#e5e5e5]">
            {user?.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
            <AvatarFallback className="text-xl bg-[#f0f0f0] text-[#555]">{user?.name?.charAt(0) ?? '?'}</AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-white" />
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>
        <div>
          <p className="text-sm font-medium text-[#1a1a1a]">{user?.name ?? '用户'}</p>
          <p className="text-xs text-[#777]">{user?.email}</p>
        </div>
      </div>

      {/* Display name */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase text-[#777] tracking-wider">显示名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#e5e5e5] rounded-lg bg-[#f5f5f5] focus:outline-none focus:border-[#999] transition-colors"
        />
      </div>

      {/* Email */}
      <div className="flex items-center gap-2 text-sm text-[#777]">
        <Mail className="w-4 h-4" />
        <span>{user?.email ?? '--'}</span>
      </div>

      {/* Role */}
      <div className="flex items-center gap-2 text-sm text-[#777]">
        <Shield className="w-4 h-4" />
        <span>{isAdmin ? '管理员' : '成员'}</span>
      </div>

      {/* Copy Token (admin) */}
      {isAdmin && (
        <button
          onClick={handleCopyToken}
          className="flex items-center gap-1.5 text-sm text-[#777] hover:text-[#1a1a1a] transition-colors"
        >
          {tokenCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {tokenCopied ? '已复制' : '复制 Token'}
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0]">
        <button
          onClick={() => { onClose(); signOut() }}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
        <button
          onClick={handleSave}
          disabled={saving || name.trim() === (user?.name ?? '')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            name.trim() !== (user?.name ?? '')
              ? 'bg-[#1a1a1a] text-white hover:bg-[#333]'
              : 'bg-[#f0f0f0] text-[#999] cursor-not-allowed',
          )}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}

function SecurityTab() {
  const { changePassword } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    if (newPassword.length < 6) { setError('新密码至少 6 个字符'); return }
    if (newPassword !== confirmPassword) { setError('两次输入的密码不一致'); return }
    setSaving(true)
    const result = await changePassword(oldPassword, newPassword)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-[#e5e5e5] rounded-lg bg-[#f5f5f5] focus:outline-none focus:border-[#999] transition-colors'

  return (
    <div className="p-6 space-y-5">
      <div>
        <h3 className="text-sm font-medium text-[#1a1a1a]">修改密码</h3>
        <p className="text-xs text-[#999] mt-1">修改后需要使用新密码重新登录</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#777]">当前密码</label>
          <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={inputClass} placeholder="输入当前密码" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#777]">新密码</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="至少 6 个字符" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#777]">确认新密码</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="再次输入新密码" />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {success && <p className="text-xs text-green-600">密码已更新</p>}

      <button
        onClick={handleSubmit}
        disabled={saving || !oldPassword || !newPassword || !confirmPassword}
        className={cn(
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
          oldPassword && newPassword && confirmPassword
            ? 'bg-[#1a1a1a] text-white hover:bg-[#333]'
            : 'bg-[#f0f0f0] text-[#999] cursor-not-allowed',
        )}
      >
        {saving ? '更新中...' : '更新密码'}
      </button>
    </div>
  )
}
