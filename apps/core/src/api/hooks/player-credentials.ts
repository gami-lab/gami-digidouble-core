import type { FastifyInstance, FastifyRequest } from 'fastify'
import { fail } from '@gami/shared'
import type { PlayerAccessService } from '../../application/auth/player-access.service.js'
import type { PlayerTokenService } from '../../application/auth/player-token.service.js'
import { DomainError } from '../../domain/errors.js'
import { readHeader, requirePlayerId, type CredentialVerifier } from './authenticate.js'

const BEARER_PREFIX = 'Bearer '

export function readBearerToken(request: FastifyRequest): string | undefined {
  const header = readHeader(request.headers.authorization)
  if (header?.startsWith(BEARER_PREFIX) !== true) return undefined
  const token = header.slice(BEARER_PREFIX.length).trim()
  return token.length > 0 ? token : undefined
}

/** Public routes accept only a valid, unexpired Core-issued player token. */
export function playerVerifier(playerTokens: PlayerTokenService): CredentialVerifier {
  return (request) => {
    const token = readBearerToken(request)
    const userId = token === undefined ? null : playerTokens.verify(token)
    return userId === null
      ? { outcome: 'unauthenticated' }
      : { outcome: 'authenticated', auth: { tier: 'public', userId } }
  }
}

/**
 * Checks, before any body is read, that every session or conversation named in a public route's
 * path belongs to the authenticated player. Foreign and unknown ids both return `404`. A
 * `messageId` is only ever looked up inside its owned conversation; `route-tiers.test.ts` fails if
 * a public route introduces any other resource param.
 */
export function registerPlayerOwnership(scope: FastifyInstance, access: PlayerAccessService): void {
  scope.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS' || request.is404) return
    if (request.routeOptions.config.tier !== 'public') return
    const params = request.params as Record<string, string | undefined>
    try {
      const userId = requirePlayerId(request)
      if (params['sessionId'] !== undefined)
        await access.requireSession(params['sessionId'], userId)
      if (params['conversationId'] !== undefined) {
        await access.requireConversation(params['conversationId'], userId)
      }
    } catch (error) {
      if (error instanceof DomainError && error.code === 'NOT_FOUND') {
        return reply.status(404).send(fail('NOT_FOUND', error.message))
      }
      throw error
    }
  })
}
