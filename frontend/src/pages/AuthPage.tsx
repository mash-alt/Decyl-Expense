import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.tsx'

type Mode = 'signin' | 'signup'

const FIREBASE_ERROR_MAP: Record<string, string> = {
  'auth/invalid-email':           'Invalid email address.',
  'auth/user-not-found':          'No account found with that email.',
  'auth/wrong-password':          'Incorrect password.',
  'auth/email-already-in-use':    'An account with this email already exists.',
  'auth/weak-password':           'Password must be at least 6 characters.',
  'auth/too-many-requests':       'Too many attempts. Please try again later.',
  'auth/popup-closed-by-user':    'Google sign-in was cancelled.',
  'auth/invalid-credential':      'Incorrect email or password.',
}

function friendlyError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return FIREBASE_ERROR_MAP[(err as { code: string }).code] ?? 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth()

  const [mode,     setMode]     = useState<Mode>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') await signIn(email, password)
      else                   await signUp(email, password)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(m => m === 'signin' ? 'signup' : 'signin')
    setError('')
  }

  return (
    <div className="auth-shell">
      <div className="auth-card glass-panel">

        {/* Brand */}
        <div className="auth-brand">
          <img src="/decyl-logo.png" alt="Decyl Expense" className="auth-logo" />
          <div>
            <p className="eyebrow">Welcome to</p>
            <h1 className="auth-title">Decyl Expense</h1>
            <p className="auth-subtitle">Your AI-powered budget companion</p>
          </div>
        </div>

        {/* Google */}
        <button
          type="button"
          className="google-button"
          onClick={() => void handleGoogle()}
          disabled={loading}
        >
          <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Email / password form */}
        <form className="auth-form" onSubmit={e => void handleSubmit(e)}>
          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={loading || !email || !password}
          >
            {loading
              ? '…'
              : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button type="button" className="text-button auth-switch-btn" onClick={toggleMode}>
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
