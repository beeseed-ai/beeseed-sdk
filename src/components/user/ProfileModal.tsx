import { useState, useRef } from 'react'
import { Camera, Mail, LogOut, User, X } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { Dialog } from '../ui/dialog.js'
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar.js'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileModal({ open, onOpenChange }: Props) {
  const { user, signOut, updateAvatar } = useAuth()
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    await updateAvatar(file)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSignOut = () => {
    onOpenChange(false)
    signOut()
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="w-full max-w-[420px] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
        {/* Header with close */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <h2 className="text-base font-semibold">个人中心</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Avatar + Info */}
        <div className="flex flex-col items-center pt-6 pb-4 px-6">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            <Avatar className="size-20">
              {user.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {user.name?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className={cn(
              'absolute inset-0 rounded-full flex items-center justify-center transition-opacity',
              'bg-black/40 opacity-0 group-hover:opacity-100',
              uploading && 'opacity-100',
            )}>
              {uploading ? (
                <span className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="mt-3 text-center">
            <div className="text-lg font-semibold">{user.name}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{user.email}</div>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 pb-5 space-y-3">
          <div className="rounded-lg bg-[#f8f8f6] px-4 py-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-[#555]">
                <Mail className="w-3.5 h-3.5" />
                邮箱
              </div>
              <span className="text-sm">{user.email}</span>
            </div>
            <div className="border-t border-black/5" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-[#555]">
                <User className="w-3.5 h-3.5" />
                角色
              </div>
              <span className="text-sm">
                {user.role === 'admin' || user.role === 'super_admin' ? '管理员' : '成员'}
              </span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </div>
    </Dialog>
  )
}
