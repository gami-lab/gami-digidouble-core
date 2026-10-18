import { useState, type JSX } from 'react'
import { ApiError } from '../api/client'
import { signIn } from '../api/auth'

type LoginPageProps = {
  onSignedIn: () => void
}

export function LoginPage({ onSignedIn }: LoginPageProps): JSX.Element {
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
    <main className="admin-login">
      <form
        className="admin-card admin-login-card"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h1>Gami DigiDouble — Admin</h1>
        <label>
          Password
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
          <p className="admin-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="admin-button admin-button-primary"
          disabled={isSubmitting || password.length === 0}
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
