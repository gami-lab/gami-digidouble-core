import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IssuePlayerTokenRequest, PlayerTokenResponse } from '@gami/shared'
import type { PlayerTokenService } from '../../application/auth/player-token.service.js'
import { readBearerToken } from '../hooks/player-credentials.js'

export type PlayerAuthRouteOptions = {
  playerTokens: PlayerTokenService
}

/**
 * `POST /v1/auth/player` creates a Core-generated player identity, or, when called with a signed
 * token that is unexpired or within the refresh window, issues a fresh token for the same player.
 */
export const playerAuthRoute: FastifyPluginCallback<PlayerAuthRouteOptions> = (app, options) => {
  app.post('/auth/player', { config: { tier: 'open' } }, async (request, reply) => {
    const presented = readBearerToken(request)
    const grant =
      presented === undefined
        ? options.playerTokens.createPlayer()
        : options.playerTokens.refresh(presented)
    if (grant === null) {
      return await reply
        .status(401)
        .send(fail('UNAUTHORIZED', 'Player token is invalid or expired'))
    }

    request.log.info(
      {
        event: presented === undefined ? 'player_auth.created' : 'player_auth.refreshed',
        userId: grant.userId,
      },
      'Player token issued',
    )
    return await reply.send(ok<PlayerTokenResponse>(grant))
  })
}

const issuePlayerTokenBodySchema = {
  type: 'object',
  required: ['userId'],
  properties: {
    userId: { type: 'string', minLength: 1, maxLength: 200, pattern: '^\\S+$' },
  },
  additionalProperties: false,
} as const

/** Operator tools act as an existing player (console debugging, evaluation continuity). */
export const adminPlayerTokenRoute: FastifyPluginCallback<PlayerAuthRouteOptions> = (
  app,
  options,
) => {
  app.post<{ Body: IssuePlayerTokenRequest }>(
    '/player-tokens',
    { schema: { body: issuePlayerTokenBodySchema } },
    async (request, reply) => {
      request.log.info(
        { event: 'player_auth.issued_by_admin', userId: request.body.userId },
        'Player token issued for an operator',
      )
      return await reply
        .status(201)
        .send(ok<PlayerTokenResponse>(options.playerTokens.issue(request.body.userId)))
    },
  )
}
