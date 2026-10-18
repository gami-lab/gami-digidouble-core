import { useEffect, useState, type JSX, type ReactNode } from 'react'
import { getAdminIdentity } from '../api/auth'
import { onSignedOut } from '../api/client'
import { LoginPage } from './LoginPage'

type AuthState = 'checking' | 'signed-out' | 'signed-in' | 'unreachable'

/** Shows the login screen until Core confirms an admin session; any later 401 returns here. */
export function AuthGate({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<AuthState>('checking')

  useEffect(() => {
    let isActive = true
    getAdminIdentity()
      .then((identity) => {
        if (isActive) setState(identity === null ? 'signed-out' : 'signed-in')
      })
      .catch(() => {
        if (isActive) setState('unreachable')
      })
    const unsubscribe = onSignedOut(() => {
      setState('signed-out')
    })
    return () => {
      isActive = false
      unsubscribe()
    }
  }, [])

  if (state === 'checking') return <p className="admin-login">Checking sign-in…</p>
  if (state === 'unreachable') {
    return <p className="admin-login admin-error">Core is unreachable. Reload to retry.</p>
  }
  if (state === 'signed-out') {
    return (
      <LoginPage
        onSignedIn={() => {
          setState('signed-in')
        }}
      />
    )
  }
  return <>{children}</>
}
