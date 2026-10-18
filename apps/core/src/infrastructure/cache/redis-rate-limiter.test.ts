import { describe, expect, it } from 'vitest'
import { RedisRateLimiter } from './redis-rate-limiter.js'

function createFakeRedis(ttlSeconds: number) {
  const counts = new Map<string, number>()
  const commands: string[][] = []
  return {
    commands,
    multi() {
      const replies: [Error | null, unknown][] = []
      const chain = {
        incr(key: string) {
          commands.push(['incr', key])
          const next = (counts.get(key) ?? 0) + 1
          counts.set(key, next)
          replies.push([null, next])
          return chain
        },
        expire(key: string, seconds: number, mode: 'NX') {
          commands.push(['expire', key, String(seconds), mode])
          replies.push([null, 1])
          return chain
        },
        ttl(key: string) {
          commands.push(['ttl', key])
          replies.push([null, ttlSeconds])
          return chain
        },
        exec: () => Promise.resolve(replies),
      }
      return chain
    },
  }
}

describe('RedisRateLimiter', () => {
  it('counts in one transaction that only starts the window on the first hit', async () => {
    const redis = createFakeRedis(42)
    const limiter = new RedisRateLimiter(redis)

    expect(await limiter.consume('message:user:u1', 1, 60)).toEqual({ allowed: true })
    expect(await limiter.consume('message:user:u1', 1, 60)).toEqual({
      allowed: false,
      retryAfterSeconds: 42,
    })
    expect(redis.commands.slice(0, 3)).toEqual([
      ['incr', 'rate_limit:message:user:u1'],
      ['expire', 'rate_limit:message:user:u1', '60', 'NX'],
      ['ttl', 'rate_limit:message:user:u1'],
    ])
  })

  it('surfaces an unexpected reply so the caller can fail open', async () => {
    const limiter = new RedisRateLimiter({
      multi: () => {
        const chain = {
          incr: () => chain,
          expire: () => chain,
          ttl: () => chain,
          exec: () => Promise.resolve(null),
        }
        return chain
      },
    })

    await expect(limiter.consume('k', 1, 60)).rejects.toThrow('unexpected Redis reply')
  })
})
