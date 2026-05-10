import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { UpsertUserPersonaResponse, UserPersonaResponse } from '@gami/shared'
import type { IUserMemoryFactRepository } from '../../application/ports/IUserMemoryFactRepository.js'
import type { IUserRepository } from '../../application/ports/IUserRepository.js'
import { DeleteUserMemoryFactUseCase } from '../../application/use-cases/delete-user-memory-fact/delete-user-memory-fact.use-case.js'
import type { DeleteUserMemoryFactOutput } from '../../application/use-cases/delete-user-memory-fact/delete-user-memory-fact.types.js'
import { GetUserPersonaUseCase } from '../../application/use-cases/get-user-persona/get-user-persona.use-case.js'
import { ListUserMemoryFactsUseCase } from '../../application/use-cases/list-user-memory-facts/list-user-memory-facts.use-case.js'
import { UpsertUserPersonaUseCase } from '../../application/use-cases/upsert-user-persona/upsert-user-persona.use-case.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import type { UserPersona } from '../../domain/user/index.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

type UsersRouteOptions = {
  config: Config
  userRepository?: IUserRepository
  userMemoryFactRepository?: IUserMemoryFactRepository
}

type UserParams = {
  userId: string
}
type UserFactParams = {
  userId: string
  factId: string
}

const userParamsSchema = {
  type: 'object',
  required: ['userId'],
  properties: {
    userId: { type: 'string', minLength: 1, pattern: '.*\\S.*' },
  },
  additionalProperties: false,
} as const

const userFactParamsSchema = {
  type: 'object',
  required: ['userId', 'factId'],
  properties: {
    userId: { type: 'string', minLength: 1, pattern: '.*\\S.*' },
    factId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

// UserPersona validation is intentionally manual rather than via Fastify JSON schema
// additionalProperties:false. The persona shape is designed to grow incrementally — adding a
// new optional field only requires updating this Set and one conditional, rather than
// coordinating schema changes across route and type definitions.
const allowedPersonaKeys = new Set(['name', 'roleInWorld', 'avatarRelationships', 'dialogGuidance'])

export const usersRoute: FastifyPluginCallback<UsersRouteOptions> = (app, options) => {
  const userRepository = options.userRepository
  if (userRepository === undefined) {
    throw new Error('usersRoute requires userRepository')
  }
  const userMemoryFactRepository =
    options.userMemoryFactRepository ?? new InMemoryUserMemoryFactRepository()
  const upsertUserPersonaUseCase = new UpsertUserPersonaUseCase(userRepository)
  const getUserPersonaUseCase = new GetUserPersonaUseCase(userRepository)
  const listUserMemoryFactsUseCase = new ListUserMemoryFactsUseCase(userMemoryFactRepository)
  const deleteUserMemoryFactUseCase = new DeleteUserMemoryFactUseCase(userMemoryFactRepository)
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
        return await reply.status(200).send(ok<UpsertUserPersonaResponse>(output))
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
        return await reply.status(200).send(ok<UserPersonaResponse>(output))
      } catch (error) {
        app.log.error({ err: error }, 'Failed to get user persona')
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )

  app.get<{ Params: UserParams }>(
    '/:userId/memory-facts',
    { schema: { params: userParamsSchema } },
    async (request, reply) => {
      try {
        const output = await listUserMemoryFactsUseCase.execute({ userId: request.params.userId })
        return await reply
          .status(200)
          .send(
            ok<{ facts: ReturnType<typeof toFactDto>[] }>({ facts: output.facts.map(toFactDto) }),
          )
      } catch (error) {
        app.log.error({ err: error }, 'Failed to list user memory facts')
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )

  app.delete<{ Params: UserFactParams }>(
    '/:userId/memory-facts/:factId',
    { schema: { params: userFactParamsSchema } },
    async (request, reply) => {
      try {
        const output = await deleteUserMemoryFactUseCase.execute({
          userId: request.params.userId,
          factId: request.params.factId,
        })
        return await reply.status(200).send(ok<DeleteUserMemoryFactOutput>(output))
      } catch (error) {
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          return await reply.status(404).send(fail('NOT_FOUND', error.message))
        }
        app.log.error({ err: error }, 'Failed to delete user memory fact')
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}

function toFactDto(fact: {
  id: string
  userId: string
  category: string
  key: string
  value: string
  confidence?: number | null
  updatedAt: string
}): {
  id: string
  userId: string
  category: string
  key: string
  value: string
  confidence?: number | null
  updatedAt: string
} {
  return {
    id: fact.id,
    userId: fact.userId,
    category: fact.category,
    key: fact.key,
    value: fact.value,
    confidence: fact.confidence ?? null,
    updatedAt: fact.updatedAt,
  }
}

function validatePersonaBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'Invalid request body'
  }
  const persona = body as Record<string, unknown>

  if (hasUnknownPersonaKey(persona)) {
    return 'Invalid request body'
  }
  if (
    !isOptionalString(persona['name']) ||
    !isOptionalString(persona['roleInWorld']) ||
    !isOptionalString(persona['dialogGuidance'])
  ) {
    return 'Invalid request body'
  }
  if (!isOptionalStringArray(persona['avatarRelationships'])) {
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
