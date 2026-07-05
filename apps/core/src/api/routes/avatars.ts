import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { AvatarSummary, UpdateAvatarRequest, UpdateAvatarResponse } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import { DeleteAvatarUseCase } from '../../application/use-cases/delete-avatar/delete-avatar.use-case.js'
import type { DeleteAvatarOutput } from '../../application/use-cases/delete-avatar/delete-avatar.types.js'
import { UpdateAvatarUseCase } from '../../application/use-cases/update-avatar/update-avatar.use-case.js'
import type { UpdateAvatarInput } from '../../application/use-cases/update-avatar/update-avatar.types.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import type { ProviderName } from '../../domain/model-config/index.js'
import { isProviderName, PROVIDER_NAMES } from '../../domain/model-config/index.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type AvatarsRouteOptions = {
  config: Config
  avatarRepository?: IAvatarRepository
  sessionRepository?: ISessionRepository
}

type AvatarParams = {
  avatarId: string
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
    llmOverride: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            model: { type: 'string' },
          },
          additionalProperties: false,
        },
      ],
    },
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

  app.patch<{ Params: AvatarParams; Body: UpdateAvatarRequest }>(
    '/:avatarId',
    { schema: { params: avatarIdParamsSchema, body: patchAvatarBodySchema } },
    async (request, reply) => {
      try {
        const validationError = validateLlmOverride(request.body.llmOverride)
        if (validationError !== null) {
          return await reply.status(400).send(fail('VALIDATION_ERROR', validationError))
        }

        const output = await updateAvatarUseCase.execute(
          buildUpdateAvatarInput(request.params.avatarId, request.body),
        )
        return await reply.send(ok<UpdateAvatarResponse>(mapUpdateAvatarResponse(output)))
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

function buildUpdateAvatarInput(avatarId: string, body: UpdateAvatarRequest): UpdateAvatarInput {
  const { name, personaPrompt, tone, description, adjustments, llmOverride, config, status } = body
  const normalizedLlmOverride = normalizeLlmOverride(llmOverride)
  return {
    avatarId,
    ...(name !== undefined ? { name } : {}),
    ...(personaPrompt !== undefined ? { personaPrompt } : {}),
    ...(tone !== undefined ? { tone } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(adjustments !== undefined ? { adjustments } : {}),
    ...(normalizedLlmOverride !== undefined ? { llmOverride: normalizedLlmOverride } : {}),
    ...(config !== undefined ? { config } : {}),
    ...(status !== undefined ? { status } : {}),
  }
}

function mapUpdateAvatarResponse(output: { avatar: AvatarSummary }): UpdateAvatarResponse {
  return { avatar: output.avatar }
}

function validateLlmOverride(value: UpdateAvatarRequest['llmOverride']): string | null {
  if (value === undefined || value === null) return null

  if (value.provider !== undefined && !isProviderName(value.provider)) {
    return `llmOverride.provider must be one of: ${PROVIDER_NAMES.join(', ')}`
  }
  if (value.model !== undefined && value.model.trim().length === 0) {
    return 'llmOverride.model must be a non-empty string when provided'
  }

  return null
}

function normalizeLlmOverride(
  llmOverride: UpdateAvatarRequest['llmOverride'],
): UpdateAvatarInput['llmOverride'] {
  if (llmOverride === undefined) return undefined
  if (llmOverride === null) return null

  return {
    ...(llmOverride.provider !== undefined
      ? { provider: llmOverride.provider as ProviderName }
      : {}),
    ...(llmOverride.model !== undefined ? { model: llmOverride.model.trim() } : {}),
  }
}
