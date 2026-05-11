import { useState, useRef } from 'react'
import { Camera, Mail, LogOut, User } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { Dialog, DialogContent } from '../ui/dialog.js'
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar.js'
import { Button } from '../ui/button.js'

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
      <DialogContent
        className="sm:max-w-[400px] p-0 overflow-hidden"
        showCloseButton
        onClose={() => onOpenChange(false)}
      >
        {/* Banner */}
        <div className="h-20 bg-gradient-to-r from-[#1a1a1a] to-[#333]" />

        {/* Avatar overlapping banner */}
        <div className="px-6 -mt-10">
          <div className="relative inline-block group">
            <Avatar className="size-20 ring-4 ring-white">
              {user.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {user.name?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileRef.current?.click()}
              className={cn(
                'absolute inset-0 rounded-full flex items-center justify-center transition-opacity',
                'bg-black/40 opacity-0 group-hover:opacity-100',
                uploading && 'opacity-100',
              )}
            >
              {uploading ? (
                <span className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Info */}
        <div className="px-6 pt-3 pb-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{user.name}</h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {user.email}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#555]">角色</label>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f5f5f5] text-sm text-[#555]">
              <User className="w-3.5 h-3.5" />
              {user.role === 'admin' || user.role === 'super_admin' ? '管理员' : '成员'}
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
