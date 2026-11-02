import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../supabase'
import type { AuthStatus } from './gate'
import { AuthContext } from './authContext'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setEmail(session?.user.email ?? null)
      setStatus(session ? 'signed-in' : 'signed-out')
    })

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      setEmail(session?.user.email ?? null)
      setStatus(session ? 'signed-in' : 'signed-out')
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(address: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({
      email: address.trim(),
      password,
    })
    return error?.message ?? null
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  const value = useMemo(
    () => ({ status, email, signIn, signOut }),
    [status, email],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
