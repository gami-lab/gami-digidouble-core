import { describe, expect, it } from 'vitest'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const ADMIN_PASSWORD = 'e2e-admin-password'
const ADMIN_ORIGIN = 'http://admin.e2e.test'
const SHARED_API_KEY = 'e2e-stack-secret-0123456789abcdef0123'

async function login(password: string): Promise<Response> {
  return await fetch(`${APP_URL}/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

async function signIn(): Promise<string> {
  const response = await login(ADMIN_PASSWORD)
  expect(response.status).toBe(200)
  const cookie = response.headers.get('set-cookie')?.split(';')[0]
  if (cookie === undefined) throw new Error('Missing admin session cookie')
  return cookie
}

describe('Stack E2E — admin authentication', () => {
  it('rejects an admin route without a credential (401)', async () => {
    const response = await fetch(`${APP_URL}/v1/admin/auth/me`)

    expect(response.status).toBe(401)
  })

  it('rejects the shared API key on admin routes (401)', async () => {
    const response = await fetch(`${APP_URL}/v1/admin/scenarios`, {
      headers: { 'x-api-key': SHARED_API_KEY },
    })

    expect(response.status).toBe(401)
  })

  it('rejects an invalid login body (400)', async () => {
    const response = await fetch(`${APP_URL}/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: '', extra: true }),
    })

    expect(response.status).toBe(400)
  })

  it('rejects a wrong password without a cookie (401)', async () => {
    const response = await login('not-the-password')

    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('signs in, serves admin routes with the cookie, and signs out', async () => {
    const cookie = await signIn()

    const me = await fetch(`${APP_URL}/v1/admin/auth/me`, { headers: { cookie } })
    expect(me.status).toBe(200)
    expect(await me.json()).toEqual({ data: { authenticatedBy: 'session' }, error: null })

    const scenarios = await fetch(`${APP_URL}/v1/admin/scenarios`, { headers: { cookie } })
    expect(scenarios.status).toBe(200)

    const logout = await fetch(`${APP_URL}/v1/admin/auth/logout`, {
      method: 'POST',
      headers: { cookie, origin: ADMIN_ORIGIN },
    })
    expect(logout.status).toBe(200)

    const afterLogout = await fetch(`${APP_URL}/v1/admin/auth/me`, { headers: { cookie } })
    expect(afterLogout.status).toBe(401)
  })

  it('rejects a cookie-authenticated state change from a foreign origin (403)', async () => {
    const cookie = await signIn()

    const response = await fetch(`${APP_URL}/v1/admin/scenarios`, {
      method: 'POST',
      headers: { cookie, origin: 'http://player.e2e.test', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'CSRF attempt' }),
    })

    expect(response.status).toBe(403)
  })
})
