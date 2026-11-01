import { isAllowedEmail } from './allowList.ts'

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out'
export type GateDecision = 'loading' | 'show-app' | 'show-login' | 'not-allowed'

interface GateInput {
  requireLogin: boolean
  status: AuthStatus
  email: string | null
  allowed: string[]
}

export function decideGate({ requireLogin, status, email, allowed }: GateInput): GateDecision {
  if (!requireLogin) {
    return 'show-app'
  }

  if (status === 'loading') {
    return 'loading'
  }

  if (status === 'signed-out') {
    return 'show-login'
  }

  return email && isAllowedEmail(email, allowed) ? 'show-app' : 'not-allowed'
}
