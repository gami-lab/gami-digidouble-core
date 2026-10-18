export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

/** Fixed-window request counter shared by every Core instance. */
export interface IRateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>
}
