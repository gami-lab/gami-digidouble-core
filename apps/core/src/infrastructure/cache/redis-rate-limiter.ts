import type { IRateLimiter, RateLimitDecision } from '../../application/ports/IRateLimiter.js'

type RedisMulti = {
  incr(key: string): RedisMulti
  expire(key: string, seconds: number, mode: 'NX'): RedisMulti
  ttl(key: string): RedisMulti
  exec(): Promise<[Error | null, unknown][] | null>
}

type RedisRateLimitClient = {
  multi(): RedisMulti
}

const KEY_PREFIX = 'rate_limit:'

/** One `MULTI` round trip per request: increment, start the window on first hit, read its TTL. */
export class RedisRateLimiter implements IRateLimiter {
  constructor(private readonly redis: RedisRateLimitClient) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const redisKey = `${KEY_PREFIX}${key}`
    const results = await this.redis
      .multi()
      .incr(redisKey)
      .expire(redisKey, windowSeconds, 'NX')
      .ttl(redisKey)
      .exec()
    const count = readNumber(results, 0)
    if (count <= limit) return { allowed: true }
    const ttl = readNumber(results, 2)
    return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds }
  }
}

function readNumber(results: [Error | null, unknown][] | null, index: number): number {
  const entry = results?.[index]
  if (entry === undefined || entry[0] !== null || typeof entry[1] !== 'number') {
    throw new Error('Rate limit counter returned an unexpected Redis reply')
  }
  return entry[1]
}
