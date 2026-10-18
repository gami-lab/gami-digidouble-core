import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { fail } from '@gami/shared'
import type { RouteTier } from '../route-tiers.js'

export type CredentialVerifier = (request: FastifyRequest) => boolean | Promise<boolean>

function readHeader(raw: string | string[] | undefined): string | undefined {
  if (typeof raw === 'string') return raw
  return raw?.[0]
}

export function areSecretsEqual(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  if (receivedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

export function apiKeyVerifier(apiKeySecret: string): CredentialVerifier {
  return (request) => {
    const apiKey = readHeader(request.headers['x-api-key'])
    return apiKey !== undefined && areSecretsEqual(apiKey, apiKeySecret)
  }
}

export type TierVerifiers = Record<Exclude<RouteTier, 'open'>, CredentialVerifier>

/**
 * Registers the single authentication hook for every route, choosing the verifier from the
 * route's tier. It runs at `onRequest`, before any content-type parser, so unauthenticated voice,
 * upload, and audio requests are rejected without their body being read.
 */
export function registerAuthentication(app: FastifyInstance, verifiers: TierVerifiers): void {
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS' || request.is404) return
    const tier = request.routeOptions.config.tier
    if (tier === 'open') return
    if (tier !== undefined && (await verifiers[tier](request))) return

    return reply.status(401).send(fail('UNAUTHORIZED', 'Invalid API key'))
  })
}
