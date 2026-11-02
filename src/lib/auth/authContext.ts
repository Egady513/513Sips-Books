import { createContext } from 'react'
import type { AuthStatus } from './gate'

export interface AuthContextValue {
  status: AuthStatus
  email: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
