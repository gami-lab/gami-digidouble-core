import { beforeAll, describe, expect, it } from 'vitest'
import type { ApiResponse, AdminLoginResponse, AdminMeResponse } from '@gami/shared'
import { InMemoryAdminSessionStore } from '../../application/auth/in-memory-admin-session.store.js'
import { hashPassword } from '../../application/auth/password-hash.js'
import type { Config } from '../../config.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const PASSWORD = 'operator-password'
const ADMIN_ORIGIN = 'http://admin.test'
let config: Config

beforeAll(async () => {
  config = { ...TEST_CONFIG, adminPasswordHash: await hashPassword(PASSWORD) }
})

function createAuthServer(store = new InMemoryAdminSessionStore()) {
  return createServer(config, { adminSessionStore: store })
}

async function signIn(app: ReturnType<typeof createServer>): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/admin/auth/login',
    payload: { password: PASSWORD },
  })
  expect(response.statusCode).toBe(200)
  const setCookie = response.headers['set-cookie']
  if (typeof setCookie !== 'string') throw new Error('Missing session cookie')
  return setCookie.split(';')[0] ?? ''
}

describe('POST /v1/admin/auth/login', () => {
  it('rejects an invalid body with 400', async () => {
    const response = await createAuthServer().inject({
      method: 'POST',
      url: '/v1/admin/auth/login',
      payload: { password: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a wrong password with 401 and sets no cookie', async () => {
    const response = await createAuthServer().inject({
      method: 'POST',
      url: '/v1/admin/auth/login',
      payload: { password: 'wrong-password' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    })
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('rejects every password when no password hash is configured', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/admin/auth/login',
      payload: { password: PASSWORD },
    })

    expect(response.statusCode).toBe(401)
  })

  it('sets an HttpOnly, Secure, SameSite=Strict cookie scoped to admin routes', async () => {
    const response = await createAuthServer().inject({
      method: 'POST',
      url: '/v1/admin/auth/login',
      payload: { password: PASSWORD },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ApiResponse<AdminLoginResponse>>().data?.expiresAt).toEqual(
      expect.any(String),
    )
    const cookie = String(response.headers['set-cookie'])
    expect(cookie).toMatch(/^gami_admin_session=[\w-]{40,};/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/v1/admin')
    expect(cookie).toContain(`Max-Age=${String(TEST_CONFIG.adminSessionTtlSeconds)}`)
    expect(response.body).not.toContain(PASSWORD)
  })
})

describe('admin session cookie', () => {
  it('authenticates admin routes after sign-in', async () => {
    const app = createAuthServer()
    const cookie = await signIn(app)

    const me = await app.inject({ method: 'GET', url: '/v1/admin/auth/me', headers: { cookie } })
    const scenarios = await app.inject({
      method: 'GET',
      url: '/v1/admin/scenarios',
      headers: { cookie },
    })

    expect(me.json<ApiResponse<AdminMeResponse>>().data).toEqual({ authenticatedBy: 'session' })
    expect(scenarios.statusCode).toBe(200)
  })

  it('rejects admin routes without a credential', async () => {
    const response = await createAuthServer().inject({ method: 'GET', url: '/v1/admin/auth/me' })

    expect(response.statusCode).toBe(401)
  })

  it('rejects the old shared API key on admin routes', async () => {
    const response = await createAuthServer().inject({
      method: 'GET',
      url: '/v1/admin/scenarios',
      headers: { 'x-api-key': TEST_CONFIG.apiKeySecret },
    })

    expect(response.statusCode).toBe(401)
  })

  it('rejects an unknown session cookie', async () => {
    const response = await createAuthServer().inject({
      method: 'GET',
      url: '/v1/admin/auth/me',
      headers: { cookie: 'gami_admin_session=forged' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('expires the session after its TTL', async () => {
    let now = Date.now()
    const app = createAuthServer(new InMemoryAdminSessionStore(() => now))
    const cookie = await signIn(app)

    now += TEST_CONFIG.adminSessionTtlSeconds * 1_000
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/auth/me',
      headers: { cookie },
    })

    expect(response.statusCode).toBe(401)
  })

  it('logout invalidates the session and clears the cookie', async () => {
    const app = createAuthServer()
    const cookie = await signIn(app)

    const logout = await app.inject({
      method: 'POST',
      url: '/v1/admin/auth/logout',
      headers: { cookie, origin: ADMIN_ORIGIN },
    })
    const me = await app.inject({ method: 'GET', url: '/v1/admin/auth/me', headers: { cookie } })

    expect(logout.statusCode).toBe(200)
    expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0')
    expect(me.statusCode).toBe(401)
  })
})

describe('admin CSRF origin check', () => {
  it.each([
    ['a foreign origin', { origin: 'http://player.test' }],
    ['no origin', {}],
  ])('rejects a cookie-authenticated state change from %s with 403', async (_label, headers) => {
    const app = createAuthServer()
    const cookie = await signIn(app)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/scenarios',
      headers: { cookie, ...headers },
      payload: { name: 'Demo' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('FORBIDDEN')
  })

  it('accepts a cookie-authenticated state change from an admin origin', async () => {
    const app = createAuthServer()
    const cookie = await signIn(app)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/scenarios',
      headers: { cookie, origin: ADMIN_ORIGIN },
      payload: { name: 'Demo' },
    })

    expect(response.statusCode).toBe(201)
  })
})

describe('admin service key', () => {
  it('authenticates tools without a browser origin', async () => {
    const app = createAuthServer()
    const headers = { 'x-admin-service-key': TEST_CONFIG.adminServiceKey ?? '' }

    const me = await app.inject({ method: 'GET', url: '/v1/admin/auth/me', headers })
    const create = await app.inject({
      method: 'POST',
      url: '/v1/admin/scenarios',
      headers,
      payload: { name: 'Demo' },
    })

    expect(me.json<ApiResponse<AdminMeResponse>>().data).toEqual({
      authenticatedBy: 'service_key',
    })
    expect(create.statusCode).toBe(201)
  })

  it('rejects a wrong service key', async () => {
    const response = await createAuthServer().inject({
      method: 'GET',
      url: '/v1/admin/auth/me',
      headers: { 'x-admin-service-key': 'wrong-service-key' },
    })

    expect(response.statusCode).toBe(401)
  })
})
