import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { fail } from '@gami/shared'
import type { IRateLimiter } from '../application/ports/IRateLimiter.js'
import type {
  RateLimitPolicies,
  RateLimitPolicyName,
} from '../application/rate-limit/rate-limit-policies.js'

declare module 'fastify' {
  interface FastifyContextConfig {
    rateLimit?: RateLimitPolicyName
  }
}

/**
 * Applies the policy a route names in `config.rateLimit`. Player routes are limited per player,
 * credential-free routes per client IP (hashed, so Redis never stores the address). The check
 * fails open: a limiter outage is logged and the request proceeds, because Redis already gates
 * admin sessions and a counter outage must not take the player experience down.
 */
export function registerRateLimits(
  app: FastifyInstance,
  limiter: IRateLimiter,
  policies: RateLimitPolicies,
): void {
  app.addHook('onRequest', async (request, reply) => {
    const policyName = request.routeOptions.config.rateLimit
    if (policyName === undefined || request.method === 'OPTIONS') return
    const policy = policies[policyName]

    let decision
    try {
      decision = await limiter.consume(
        `${policyName}:${rateLimitSubject(request)}`,
        policy.max,
        policy.windowSeconds,
      )
    } catch (error) {
      request.log.warn(
        { event: 'rate_limit.unavailable', policy: policyName, err: error },
        'Rate limiter unavailable; allowing request',
      )
      return
    }
    if (decision.allowed) return

    request.log.info({ event: 'rate_limit.exceeded', policy: policyName }, 'Rate limit exceeded')
    reply.header('Retry-After', String(decision.retryAfterSeconds))
    return reply.status(429).send(fail('RATE_LIMITED', 'Too many requests; retry later'))
  })
}

function rateLimitSubject(request: FastifyRequest): string {
  if (request.auth?.tier === 'public') return `user:${request.auth.userId}`
  return `ip:${createHash('sha256').update(request.ip).digest('base64url').slice(0, 22)}`
}
