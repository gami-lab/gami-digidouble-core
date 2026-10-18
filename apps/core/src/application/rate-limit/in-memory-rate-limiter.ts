import type { IRateLimiter, RateLimitDecision } from '../ports/IRateLimiter.js'

/** Process-local fixed windows for tests and single-process development. */
export class InMemoryRateLimiter implements IRateLimiter {
  private readonly windows = new Map<string, { count: number; resetsAt: number }>()

  constructor(private readonly now: () => number = Date.now) {}

  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const now = this.now()
    let window = this.windows.get(key)
    if (window === undefined || window.resetsAt <= now) {
      window = { count: 0, resetsAt: now + windowSeconds * 1_000 }
      this.windows.set(key, window)
    }
    window.count += 1
    return Promise.resolve(
      window.count <= limit
        ? { allowed: true }
        : { allowed: false, retryAfterSeconds: Math.ceil((window.resetsAt - now) / 1_000) },
    )
  }
}
