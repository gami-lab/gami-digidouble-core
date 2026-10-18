import type { FastifyInstance, FastifyRequest } from 'fastify'
import { fail } from '@gami/shared'
import type { AdminAuthenticationMethod } from '@gami/shared'
import type { RouteTier } from '../route-tiers.js'

export type RequestAuth =
  | { tier: 'admin'; method: AdminAuthenticationMethod; sessionId?: string }
  | { tier: 'public'; userId: string }

declare module 'fastify' {
  interface FastifyRequest {
    auth: RequestAuth | null
  }
}

export type VerificationResult =
  | { outcome: 'authenticated'; auth: RequestAuth }
  | { outcome: 'unauthenticated' }
  | { outcome: 'forbidden'; message: string }

export type CredentialVerifier = (
  request: FastifyRequest,
) => VerificationResult | Promise<VerificationResult>

export type TierVerifiers = Record<Exclude<RouteTier, 'open'>, CredentialVerifier>

export function readHeader(raw: string | string[] | undefined): string | undefined {
  if (typeof raw === 'string') return raw
  return raw?.[0]
}

/** The authenticated player's id; only valid on `public` routes, where the hook guarantees it. */
export function requirePlayerId(request: FastifyRequest): string {
  if (request.auth?.tier !== 'public')
    throw new Error('Player identity is only set on public routes')
  return request.auth.userId
}

/**
 * Registers the single authentication hook for every route, choosing the verifier from the
 * route's tier. It runs at `onRequest`, before any content-type parser, so unauthenticated voice,
 * upload, and audio requests are rejected without their body being read.
 */
export function registerAuthentication(app: FastifyInstance, verifiers: TierVerifiers): void {
  app.decorateRequest('auth', null)
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS' || request.is404) return
    const tier = request.routeOptions.config.tier
    if (tier === 'open') return

    const result: VerificationResult =
      tier === undefined ? { outcome: 'unauthenticated' } : await verifiers[tier](request)
    if (result.outcome === 'authenticated') {
      request.auth = result.auth
      return
    }
    if (result.outcome === 'forbidden') {
      return reply.status(403).send(fail('FORBIDDEN', result.message))
    }
    return reply.status(401).send(fail('UNAUTHORIZED', 'Missing or invalid credentials'))
  })
}
