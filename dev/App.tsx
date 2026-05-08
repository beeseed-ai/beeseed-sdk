import { useState } from 'react'
import {
  BeeSeedProvider,
  AuthGuard,
  LoginForm,
  RegisterForm,
  ChatLayout,
} from '../src/index.js'

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      {mode === 'login' ? (
        <LoginForm onSwitchToRegister={() => setMode('register')} />
      ) : (
        <RegisterForm onSwitchToLogin={() => setMode('login')} />
      )}
    </div>
  )
}

export function App() {
  return (
    <BeeSeedProvider config={{ workerUrl: '' }}>
      <AuthGuard fallback={<AuthScreen />}>
        <ChatLayout />
      </AuthGuard>
    </BeeSeedProvider>
  )
}
