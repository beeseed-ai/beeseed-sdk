import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/use-auth.js'
import { useAppConfig } from '../../hooks/use-app-config.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'

interface Props {
  onSwitchToRegister?: () => void
  className?: string
}

export function LoginForm({ onSwitchToRegister, className }: Props) {
  const { signIn, signInWithSMS, signUpWithSMS, sendSMSCode } = useAuth()
  const { branding } = useAppConfig()
  const [logoFailed, setLogoFailed] = useState(false)
  const [mode, setMode] = useState<'password' | 'sms'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [smsPurpose, setSmsPurpose] = useState<'login' | 'register'>('login')
  const hasLogo = Boolean(branding.logo && !logoFailed)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'sms') {
      if (!phone || !code) { setError('请填写手机号和验证码'); return }
      setLoading(true)
      setError('')
      const result = smsPurpose === 'register'
        ? await signUpWithSMS(phone, code, phone)
        : await signInWithSMS(phone, code)
      if (result.error) setError(result.error)
      setLoading(false)
      return
    }
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true)
    setError('')
    const result = await signIn(email, password)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  async function handleSendCode() {
    if (!phone) { setError('请填写手机号'); return }
    setSendingCode(true)
    setError('')
    const result = await sendSMSCode(phone, 'login')
    if (result.error) setError(result.error)
    else setSmsPurpose(result.purpose || 'login')
    setSendingCode(false)
  }

  return (
    <div className={className} data-testid="login-form">
      <div className="mx-auto w-full max-w-sm space-y-6 rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="space-y-3 text-center">
          {hasLogo ? (
            <img
              src={branding.logo}
              alt={branding.title}
              className="mx-auto h-10 w-auto max-w-[220px] rounded-md object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-[#181d26] text-sm font-medium text-white">
              {Array.from(branding.title)[0] || 'B'}
            </div>
          )}
          <div className="space-y-1">
            {!hasLogo && <div className="truncate text-sm font-medium text-muted-foreground">{branding.title}</div>}
            <h1 className="text-xl font-semibold">登录</h1>
            <p className="text-sm text-muted-foreground">登录你的账号</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 rounded-md border border-border p-1 text-sm">
          <button type="button" className={`rounded px-3 py-1.5 ${mode === 'password' ? 'bg-[#181d26] text-white' : 'text-muted-foreground'}`} onClick={() => setMode('password')}>密码</button>
          <button type="button" className={`rounded px-3 py-1.5 ${mode === 'sms' ? 'bg-[#181d26] text-white' : 'text-muted-foreground'}`} onClick={() => setMode('sms')}>短信</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'password' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">邮箱</label>
                <Input
                  data-testid="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">密码</label>
                <Input
                  data-testid="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">手机号</label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setSmsPurpose('login')
                  }}
                  placeholder="输入手机号"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">验证码</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6 位验证码"
                  />
                  <Button type="button" variant="outline" disabled={sendingCode} onClick={handleSendCode}>
                    {sendingCode ? '发送中' : '发送'}
                  </Button>
                </div>
              </div>
            </>
          )}
          <Button data-testid="login-submit" className="w-full" disabled={loading}>
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
              没有 Hive 账号？创建
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
