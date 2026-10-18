import { useState, type JSX } from 'react'
import { ApiError } from '../api/client'
import { signIn } from '../api/auth'

export function LoginPage({ onSignedIn }: { onSignedIn: () => void }): JSX.Element {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(): Promise<void> {
    setIsSubmitting(true)
    setError(null)
    try {
      await signIn(password)
      setPassword('')
      onSignedIn()
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === 'UNAUTHORIZED'
          ? 'Wrong password.'
          : 'Sign-in failed. Check that Core is reachable.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page">
      <form
        className="card login-card"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h1>Gami debug console</h1>
        <label>
          Admin password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
            required
          />
        </label>
        {error !== null ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="primary" disabled={isSubmitting || password.length === 0}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
