import { describe, expect, it } from 'vitest'
import { InMemoryRateLimiter } from './in-memory-rate-limiter.js'

describe('InMemoryRateLimiter', () => {
  it('allows up to the limit per key and resets after the window', async () => {
    let now = 0
    const limiter = new InMemoryRateLimiter(() => now)

    expect(await limiter.consume('a', 2, 10)).toEqual({ allowed: true })
    expect(await limiter.consume('a', 2, 10)).toEqual({ allowed: true })
    now = 4_000
    expect(await limiter.consume('a', 2, 10)).toEqual({ allowed: false, retryAfterSeconds: 6 })
    expect(await limiter.consume('b', 2, 10)).toEqual({ allowed: true })
    now = 10_000
    expect(await limiter.consume('a', 2, 10)).toEqual({ allowed: true })
  })
})
