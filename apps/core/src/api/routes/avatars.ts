import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import { DeleteAvatarUseCase } from '../../application/use-cases/delete-avatar/delete-avatar.use-case.js'
import type { DeleteAvatarOutput } from '../../application/use-cases/delete-avatar/delete-avatar.types.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

type AvatarsRouteOptions = {
  config: Config
  avatarRepository?: IAvatarRepository
  sessionRepository?: ISessionRepository
}

type DeleteAvatarParams = {
  avatarId: string
}

const deleteAvatarParamsSchema = {
  type: 'object',
  required: ['avatarId'],
  properties: {
    avatarId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

export const avatarsRoute: FastifyPluginCallback<AvatarsRouteOptions> = (app, options) => {
  const avatarRepository = options.avatarRepository ?? new InMemoryAvatarRepository()
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository()
  const deleteAvatarUseCase = new DeleteAvatarUseCase(avatarRepository, sessionRepository)

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.delete<{ Params: DeleteAvatarParams }>(
    '/:avatarId',
    { schema: { params: deleteAvatarParamsSchema } },
    async (request, reply) => {
      try {
        const output = await deleteAvatarUseCase.execute({ avatarId: request.params.avatarId })
        return await reply.send(ok<DeleteAvatarOutput>(output))
      } catch (error) {
        if (error instanceof DomainError) {
          if (error.code === 'NOT_FOUND') {
            return await reply.status(404).send(fail('NOT_FOUND', error.message))
          }
          if (error.code === 'CONFLICT') {
            return await reply.status(409).send(fail('CONFLICT', error.message))
          }
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}
