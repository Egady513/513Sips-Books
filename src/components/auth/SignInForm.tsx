import { useState } from 'react'
import Button from '../ui/Button'
import { useAuth } from '../../lib/auth/useAuth'

interface SignInFormProps {
  allowed: string[]
}

const BAD_CREDENTIALS_MESSAGE = 'Email or password is not right.'
const GENERIC_ERROR_MESSAGE = 'Sign in could not be completed. Please try again.'

function friendlyError(message: string): string {
  return message.toLowerCase().includes('invalid login credentials')
    ? BAD_CREDENTIALS_MESSAGE
    : GENERIC_ERROR_MESSAGE
}

export default function SignInForm({ allowed }: SignInFormProps) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState(allowed[0] ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const message = await signIn(email, password)
      if (message) setError(friendlyError(message))
    } catch {
      setError(GENERIC_ERROR_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="books-sign-in-email" className="block text-sm text-cream/60 mb-1.5">
          Email
        </label>
        <input
          id="books-sign-in-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-gold-dim bg-navy px-3 py-2 text-cream outline-none focus:border-gold disabled:opacity-50"
        />
      </div>
      <div>
        <label htmlFor="books-sign-in-password" className="block text-sm text-cream/60 mb-1.5">
          Password
        </label>
        <input
          id="books-sign-in-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-gold-dim bg-navy px-3 py-2 text-cream outline-none focus:border-gold disabled:opacity-50"
        />
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
