import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/use-auth.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'

interface Props {
  onSwitchToLogin?: () => void
  className?: string
}

export function RegisterForm({ onSwitchToLogin, className }: Props) {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name) { setError('请填写昵称'); return }
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true)
    setError('')
    const result = await signUp(email, password, name)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-sm space-y-6 rounded-xl border bg-card p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold">注册</h1>
          <p className="text-sm text-muted-foreground">创建一个新账号</p>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">昵称</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的昵称"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">邮箱</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">密码</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
            />
          </div>
          <Button className="w-full" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </Button>
        </form>

        {onSwitchToLogin && (
          <div className="text-center text-sm">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              onClick={onSwitchToLogin}
            >
              已有账号？登录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
