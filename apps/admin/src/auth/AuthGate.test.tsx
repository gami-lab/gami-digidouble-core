// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAdminIdentity, signIn } from '../api/auth'
import { ApiError, notifySignedOut } from '../api/client'
import { AuthGate } from './AuthGate'

vi.mock('../api/auth', () => ({
  getAdminIdentity: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderGate(): void {
  render(
    <AuthGate>
      <p>Admin content</p>
    </AuthGate>,
  )
}

describe('AuthGate', () => {
  it('shows the login screen when nobody is signed in', async () => {
    vi.mocked(getAdminIdentity).mockResolvedValue(null)

    renderGate()

    expect(await screen.findByLabelText('Password')).toBeTruthy()
    expect(screen.queryByText('Admin content')).toBeNull()
  })

  it('shows the app after a successful sign-in', async () => {
    vi.mocked(getAdminIdentity).mockResolvedValue(null)
    vi.mocked(signIn).mockResolvedValue({ expiresAt: '2026-10-18T18:00:00.000Z' })
    renderGate()

    fireEvent.change(await screen.findByLabelText('Password'), {
      target: { value: 'operator-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Admin content')).toBeTruthy()
    expect(signIn).toHaveBeenCalledWith('operator-password')
  })

  it('keeps the login screen and explains a wrong password', async () => {
    vi.mocked(getAdminIdentity).mockResolvedValue(null)
    vi.mocked(signIn).mockRejectedValue(new ApiError('UNAUTHORIZED', 'Invalid credentials'))
    renderGate()

    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Wrong password.')
  })

  it('returns to the login screen when the session expires', async () => {
    vi.mocked(getAdminIdentity).mockResolvedValue({ authenticatedBy: 'session' })
    renderGate()
    expect(await screen.findByText('Admin content')).toBeTruthy()

    notifySignedOut()

    await waitFor(() => {
      expect(screen.queryByText('Admin content')).toBeNull()
    })
    expect(screen.getByLabelText('Password')).toBeTruthy()
  })
})
