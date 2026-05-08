import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/use-auth.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'

interface Props {
  onSwitchToRegister?: () => void
  className?: string
}

export function LoginForm({ onSwitchToRegister, className }: Props) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true)
    setError('')
    const result = await signIn(email, password)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-sm space-y-6 rounded-xl border bg-card p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold">登录</h1>
          <p className="text-sm text-muted-foreground">登录你的账号</p>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>

        {onSwitchToRegister && (
          <div className="text-center text-sm">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              onClick={onSwitchToRegister}
            >
              没有账号？注册
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
