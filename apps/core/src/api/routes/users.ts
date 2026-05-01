import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IUserRepository } from '../../application/ports/IUserRepository.js'
import { GetUserPersonaUseCase } from '../../application/use-cases/get-user-persona/get-user-persona.use-case.js'
import type { GetUserPersonaOutput } from '../../application/use-cases/get-user-persona/get-user-persona.use-case.js'
import { UpsertUserPersonaUseCase } from '../../application/use-cases/upsert-user-persona/upsert-user-persona.use-case.js'
import type { UpsertUserPersonaOutput } from '../../application/use-cases/upsert-user-persona/upsert-user-persona.use-case.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

type UsersRouteOptions = {
  config: Config
  userRepository: IUserRepository
}

type UserParams = {
  userId: string
}

type PutPersonaBody = {
  role?: string
  tonePreference?: string
  interactionHints?: string[]
}

const userParamsSchema = {
  type: 'object',
  required: ['userId'],
  properties: {
    userId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const putPersonaBodySchema = {
  type: 'object',
  properties: {
    role: { type: 'string' },
    tonePreference: { type: 'string' },
    interactionHints: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  additionalProperties: false,
} as const

export const usersRoute: FastifyPluginCallback<UsersRouteOptions> = (app, options) => {
  const upsertUserPersonaUseCase = new UpsertUserPersonaUseCase(options.userRepository)
  const getUserPersonaUseCase = new GetUserPersonaUseCase(options.userRepository)
  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.put<{ Params: UserParams; Body: PutPersonaBody }>(
    '/:userId/persona',
    { schema: { params: userParamsSchema, body: putPersonaBodySchema } },
    async (request, reply) => {
      try {
        const output = await upsertUserPersonaUseCase.execute({
          userId: request.params.userId,
          persona: request.body,
        })
        return await reply.status(200).send(ok<UpsertUserPersonaOutput>(output))
      } catch (error) {
        app.log.error({ err: error }, 'Failed to upsert user persona')
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )

  app.get<{ Params: UserParams }>(
    '/:userId/persona',
    { schema: { params: userParamsSchema } },
    async (request, reply) => {
      try {
        const output = await getUserPersonaUseCase.execute({
          userId: request.params.userId,
        })
        return await reply.status(200).send(ok<GetUserPersonaOutput>(output))
      } catch (error) {
        app.log.error({ err: error }, 'Failed to get user persona')
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}
