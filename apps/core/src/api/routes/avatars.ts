import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import { DeleteAvatarUseCase } from '../../application/use-cases/delete-avatar/delete-avatar.use-case.js'
import type { DeleteAvatarOutput } from '../../application/use-cases/delete-avatar/delete-avatar.types.js'
import { UpdateAvatarUseCase } from '../../application/use-cases/update-avatar/update-avatar.use-case.js'
import type {
  UpdateAvatarInput,
  UpdateAvatarOutput,
} from '../../application/use-cases/update-avatar/update-avatar.types.js'
import type { AvatarStatus } from '../../domain/avatar/avatar.types.js'
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

type AvatarParams = {
  avatarId: string
}

type PatchAvatarBody = {
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarStatus
}

type PatchAvatarResponse = {
  avatar: {
    avatarId: string
    scenarioId: string
    name: string
    status: AvatarStatus
    personaPrompt: string
    tone?: string
    description?: string
    adjustments?: string[]
    config: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }
}

const avatarIdParamsSchema = {
  type: 'object',
  required: ['avatarId'],
  properties: {
    avatarId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const patchAvatarBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    personaPrompt: { type: 'string', minLength: 1 },
    tone: { type: 'string' },
    description: { type: 'string' },
    adjustments: { type: 'array', items: { type: 'string' } },
    config: { type: 'object' },
    status: { type: 'string', enum: ['draft', 'active', 'archived'] },
  },
  additionalProperties: false,
} as const

export const avatarsRoute: FastifyPluginCallback<AvatarsRouteOptions> = (app, options) => {
  const avatarRepository = options.avatarRepository ?? new InMemoryAvatarRepository()
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository()
  const deleteAvatarUseCase = new DeleteAvatarUseCase(avatarRepository, sessionRepository)
  const updateAvatarUseCase = new UpdateAvatarUseCase(avatarRepository)

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.delete<{ Params: AvatarParams }>(
    '/:avatarId',
    { schema: { params: avatarIdParamsSchema } },
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
            return await reply.status(409).send(fail('CONFLICT', error.message, error.details))
          }
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )

  app.patch<{ Params: AvatarParams; Body: PatchAvatarBody }>(
    '/:avatarId',
    { schema: { params: avatarIdParamsSchema, body: patchAvatarBodySchema } },
    async (request, reply) => {
      try {
        const output = await updateAvatarUseCase.execute(
          buildUpdateAvatarInput(request.params.avatarId, request.body),
        )
        return await reply.send(ok<PatchAvatarResponse>(mapUpdateAvatarResponse(output)))
      } catch (error) {
        if (error instanceof DomainError) {
          if (error.code === 'NOT_FOUND') {
            return await reply.status(404).send(fail('NOT_FOUND', error.message))
          }
          if (error.code === 'INVALID_INPUT') {
            return await reply.status(400).send(fail('VALIDATION_ERROR', error.message))
          }
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}

function buildUpdateAvatarInput(avatarId: string, body: PatchAvatarBody): UpdateAvatarInput {
  const { name, personaPrompt, tone, description, adjustments, config, status } = body
  return {
    avatarId,
    ...(name !== undefined ? { name } : {}),
    ...(personaPrompt !== undefined ? { personaPrompt } : {}),
    ...(tone !== undefined ? { tone } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(adjustments !== undefined ? { adjustments } : {}),
    ...(config !== undefined ? { config } : {}),
    ...(status !== undefined ? { status } : {}),
  }
}

function mapUpdateAvatarResponse(output: UpdateAvatarOutput): PatchAvatarResponse {
  const { avatar } = output
  return {
    avatar: {
      avatarId: avatar.avatarId,
      scenarioId: avatar.scenarioId,
      name: avatar.name,
      status: avatar.status,
      personaPrompt: avatar.personaPrompt,
      ...(avatar.tone !== undefined ? { tone: avatar.tone } : {}),
      ...(avatar.description !== undefined ? { description: avatar.description } : {}),
      ...(avatar.adjustments !== undefined ? { adjustments: avatar.adjustments } : {}),
      config: avatar.config,
      createdAt: avatar.createdAt,
      updatedAt: avatar.updatedAt,
    },
  }
}
