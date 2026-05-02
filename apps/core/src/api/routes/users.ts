import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IUserRepository } from '../../application/ports/IUserRepository.js'
import { GetUserPersonaUseCase } from '../../application/use-cases/get-user-persona/get-user-persona.use-case.js'
import type { GetUserPersonaOutput } from '../../application/use-cases/get-user-persona/get-user-persona.use-case.js'
import { UpsertUserPersonaUseCase } from '../../application/use-cases/upsert-user-persona/upsert-user-persona.use-case.js'
import type { UpsertUserPersonaOutput } from '../../application/use-cases/upsert-user-persona/upsert-user-persona.use-case.js'
import type { Config } from '../../config.js'
import type { UserPersona } from '../../domain/user/index.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

type UsersRouteOptions = {
  config: Config
  userRepository: IUserRepository
}

type UserParams = {
  userId: string
}

const userParamsSchema = {
  type: 'object',
  required: ['userId'],
  properties: {
    userId: { type: 'string', minLength: 1, pattern: '.*\\S.*' },
  },
  additionalProperties: false,
} as const

const allowedPersonaKeys = new Set(['role', 'tonePreference', 'interactionHints'])

export const usersRoute: FastifyPluginCallback<UsersRouteOptions> = (app, options) => {
  const upsertUserPersonaUseCase = new UpsertUserPersonaUseCase(options.userRepository)
  const getUserPersonaUseCase = new GetUserPersonaUseCase(options.userRepository)
  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.put<{ Params: UserParams; Body: unknown }>(
    '/:userId/persona',
    { schema: { params: userParamsSchema } },
    async (request, reply) => {
      try {
        const validationError = validatePersonaBody(request.body)
        if (validationError !== null) {
          return await reply.status(400).send(fail('VALIDATION_ERROR', validationError))
        }
        const output = await upsertUserPersonaUseCase.execute({
          userId: request.params.userId,
          persona: request.body as UserPersona,
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

function validatePersonaBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'Invalid request body'
  }
  const persona = body as Record<string, unknown>

  if (hasUnknownPersonaKey(persona)) {
    return 'Invalid request body'
  }
  if (!isOptionalString(persona['role']) || !isOptionalString(persona['tonePreference'])) {
    return 'Invalid request body'
  }
  if (!isOptionalStringArray(persona['interactionHints'])) {
    return 'Invalid request body'
  }
  return null
}

function hasUnknownPersonaKey(persona: Record<string, unknown>): boolean {
  return Object.keys(persona).some((key) => !allowedPersonaKeys.has(key))
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isOptionalStringArray(value: unknown): boolean {
  if (value === undefined) {
    return true
  }
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
