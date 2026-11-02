import type { ReactNode } from 'react'
import Button from '../ui/Button'
import { useAuth } from '../../lib/auth/useAuth'
import { booksAllowedEmails, requireBooksLogin } from '../../lib/auth/config'
import { decideGate } from '../../lib/auth/gate'
import SignInForm from './SignInForm'

interface AuthGateProps {
  children: ReactNode
}

export default function AuthGate({ children }: AuthGateProps) {
  const { status, email, signOut } = useAuth()
  // This gate only controls the screen. The later database rule change is what will protect the data.
  const decision = decideGate({
    requireLogin: requireBooksLogin,
    status,
    email,
    allowed: booksAllowedEmails,
  })

  if (decision === 'show-app') return children

  if (decision === 'loading') {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <p className="text-sm text-cream/60">Checking sign-in...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <section className="w-full max-w-sm rounded-xl border border-gold-dim bg-navy-light p-6">
        <h1 className="text-2xl font-bold text-gold mb-2">513 Sips Books</h1>
        {decision === 'show-login' ? (
          <>
            <p className="text-sm text-cream/60 mb-5">Sign in to continue.</p>
            <SignInForm allowed={booksAllowedEmails} />
          </>
        ) : (
          <>
            <p className="text-sm text-cream mb-5">This account does not have access.</p>
            <Button type="button" variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </>
        )}
      </section>
    </main>
  )
}
