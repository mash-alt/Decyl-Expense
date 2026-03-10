import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase/firebaseConfig.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthContextType = {
  user:             User | null
  isAuthLoading:    boolean
  signIn:           (email: string, password: string) => Promise<void>
  signUp:           (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut:          () => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,          setUser]          = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => {
      setUser(u)
      setIsAuthLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const signOut = async () => {
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthLoading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
