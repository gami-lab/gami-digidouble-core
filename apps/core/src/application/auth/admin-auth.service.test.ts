import { describe, expect, it } from 'vitest'
import type { IAdminSessionStore } from '../ports/IAdminSessionStore.js'
import { AdminAuthService } from './admin-auth.service.js'
import { InMemoryAdminSessionStore } from './in-memory-admin-session.store.js'

function createService(options: { store?: IAdminSessionStore; now?: () => number } = {}) {
  return new AdminAuthService({
    store: options.store ?? new InMemoryAdminSessionStore(options.now),
    verifyCredential: (password) => Promise.resolve(password === 'operator-password'),
    sessionSecret: 'session-secret-0123456789abcdef0123',
    sessionTtlSeconds: 60,
    ...(options.now !== undefined ? { now: options.now } : {}),
  })
}

describe('AdminAuthService', () => {
  it('refuses a wrong credential without creating a session', async () => {
    const created: string[] = []
    const store: IAdminSessionStore = {
      create: (key) => {
        created.push(key)
        return Promise.resolve()
      },
      exists: () => Promise.resolve(false),
      delete: () => Promise.resolve(),
    }

    await expect(createService({ store }).signIn('wrong')).resolves.toBeNull()
    expect(created).toEqual([])
  })

  it('issues a random session that stays valid until sign-out', async () => {
    const service = createService()

    const first = await service.signIn('operator-password')
    const second = await service.signIn('operator-password')
    if (first === null || second === null) throw new Error('sign-in failed')

    expect(first.sessionId).not.toBe(second.sessionId)
    expect(first.sessionId).not.toContain('operator-password')
    await expect(service.isSignedIn(first.sessionId)).resolves.toBe(true)
    await service.signOut(first.sessionId)
    await expect(service.isSignedIn(first.sessionId)).resolves.toBe(false)
    await expect(service.isSignedIn(second.sessionId)).resolves.toBe(true)
  })

  it('stores a derived key, never the session id itself', async () => {
    const keys: string[] = []
    const inner = new InMemoryAdminSessionStore()
    const store: IAdminSessionStore = {
      create: (key, ttl) => {
        keys.push(key)
        return inner.create(key, ttl)
      },
      exists: (key) => inner.exists(key),
      delete: (key) => inner.delete(key),
    }

    const signIn = await createService({ store }).signIn('operator-password')

    expect(keys).toHaveLength(1)
    expect(keys[0]).not.toBe(signIn?.sessionId)
  })

  it('expires sessions after the configured TTL', async () => {
    let now = Date.parse('2026-10-18T10:00:00.000Z')
    const service = createService({ now: () => now })

    const signIn = await service.signIn('operator-password')
    if (signIn === null) throw new Error('sign-in failed')

    expect(signIn.expiresAt).toBe('2026-10-18T10:01:00.000Z')
    now += 59_000
    await expect(service.isSignedIn(signIn.sessionId)).resolves.toBe(true)
    now += 1_000
    await expect(service.isSignedIn(signIn.sessionId)).resolves.toBe(false)
  })
})
