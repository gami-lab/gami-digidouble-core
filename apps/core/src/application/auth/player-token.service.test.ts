import { describe, expect, it } from 'vitest'
import { PlayerTokenService } from './player-token.service.js'

const SECRET = 'player-secret-0123456789abcdef012345'

function createService(now: () => number = Date.now, secret = SECRET) {
  return new PlayerTokenService({ secret, ttlSeconds: 60, refreshWindowSeconds: 300, now })
}

describe('PlayerTokenService', () => {
  it('creates a Core-generated player and verifies its token', () => {
    const service = createService()

    const first = service.createPlayer()
    const second = service.createPlayer()

    expect(first.userId).toMatch(/^user_[0-9a-f-]{36}$/)
    expect(first.userId).not.toBe(second.userId)
    expect(service.verify(first.token)).toBe(first.userId)
  })

  it('rejects an expired token', () => {
    let now = Date.parse('2026-10-18T10:00:00.000Z')
    const service = createService(() => now)
    const grant = service.issue('user_1')

    expect(grant.expiresAt).toBe('2026-10-18T10:01:00.000Z')
    now += 59_000
    expect(service.verify(grant.token)).toBe('user_1')
    now += 1_000
    expect(service.verify(grant.token)).toBeNull()
  })

  it('rejects a tampered payload or signature', () => {
    const service = createService()
    const [payload, signature] = service.issue('user_1').token.split('.')
    const forgedPayload = Buffer.from(
      JSON.stringify({ v: 1, sub: 'user_2', iat: 0, exp: 9_999_999_999 }),
    ).toString('base64url')

    expect(service.verify(`${forgedPayload}.${signature ?? ''}`)).toBeNull()
    expect(service.verify(`${payload ?? ''}.${(signature ?? '').slice(1)}x`)).toBeNull()
    expect(service.verify('not-a-token')).toBeNull()
    expect(service.verify(`${payload ?? ''}.${signature ?? ''}.extra`)).toBeNull()
  })

  it('rejects a token signed with another secret', () => {
    const token = createService(Date.now, 'other-secret-0123456789abcdef0123456').issue('user_1')

    expect(createService().verify(token.token)).toBeNull()
  })

  it('refreshes the same player within the refresh window only', () => {
    let now = Date.parse('2026-10-18T10:00:00.000Z')
    const service = createService(() => now)
    const grant = service.issue('user_1')

    now += 200_000
    const refreshed = service.refresh(grant.token)
    expect(refreshed?.userId).toBe('user_1')
    expect(service.verify(refreshed?.token ?? '')).toBe('user_1')

    now += 400_000
    expect(service.refresh(grant.token)).toBeNull()
  })
})
