import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import { CreateAvatarUseCase } from '../../application/use-cases/create-avatar/create-avatar.use-case.js'
import type {
  CreateAvatarInput,
  CreateAvatarOutput,
} from '../../application/use-cases/create-avatar/create-avatar.types.js'
import { CreateScenarioUseCase } from '../../application/use-cases/create-scenario/create-scenario.use-case.js'
import type {
  CreateScenarioInput,
  CreateScenarioOutput,
} from '../../application/use-cases/create-scenario/create-scenario.types.js'
import type { AvatarStatus } from '../../domain/avatar/avatar.types.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type ScenariosRouteOptions = {
  config: Config
  scenarioRepository?: IScenarioRepository
  avatarRepository?: IAvatarRepository
}

type ScenarioStatus = 'draft' | 'active' | 'archived'

type CreateScenarioRequestBody = {
  name: string
  slug: string
  status?: ScenarioStatus
  config?: Record<string, unknown>
}

type CreateScenarioResponse = {
  scenario: {
    scenarioId: string
    name: string
    slug: string
    status: ScenarioStatus
    config: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }
}

type CreateAvatarRequestParams = {
  scenarioId: string
}

type CreateAvatarRequestBody = {
  name: string
  slug: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarStatus
}

type CreateAvatarResponse = {
  avatar: {
    avatarId: string
    scenarioId: string
    name: string
    slug: string
    status: AvatarStatus
    personaPrompt: string
    tone?: string
    description?: string
    adjustments?: string[]
    createdAt: string
    updatedAt: string
  }
}

const createScenarioBodySchema = {
  type: 'object',
  required: ['name', 'slug'],
  properties: {
    name: { type: 'string', minLength: 1 },
    slug: { type: 'string', minLength: 1, pattern: '^[a-z0-9-]+$' },
    status: { type: 'string', enum: ['draft', 'active', 'archived'] },
    config: { type: 'object' },
  },
  additionalProperties: false,
} as const

const createAvatarParamsSchema = {
  type: 'object',
  required: ['scenarioId'],
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const createAvatarBodySchema = {
  type: 'object',
  required: ['name', 'slug', 'personaPrompt'],
  properties: {
    name: { type: 'string', minLength: 1 },
    slug: { type: 'string', minLength: 1, pattern: '^[a-z0-9-]+$' },
    personaPrompt: { type: 'string', minLength: 1 },
    tone: { type: 'string' },
    description: { type: 'string' },
    adjustments: {
      type: 'array',
      items: { type: 'string' },
    },
    config: { type: 'object' },
    status: { type: 'string', enum: ['draft', 'active', 'archived'] },
  },
  additionalProperties: false,
} as const

export const scenariosRoute: FastifyPluginCallback<ScenariosRouteOptions> = (app, options) => {
  const scenarioRepository = options.scenarioRepository ?? new InMemoryScenarioRepository()
  const avatarRepository = options.avatarRepository ?? new InMemoryAvatarRepository()
  const createScenarioUseCase = new CreateScenarioUseCase(scenarioRepository)
  const createAvatarUseCase = new CreateAvatarUseCase(scenarioRepository, avatarRepository)

  app.post<{ Body: CreateScenarioRequestBody }>(
    '/',
    {
      schema: { body: createScenarioBodySchema },
      preHandler: authenticateApiKey(options.config.apiKeySecret),
    },
    async (request, reply) => {
      try {
        const output = await createScenarioUseCase.execute(mapCreateInput(request.body))
        return await reply.status(201).send(ok<CreateScenarioResponse>(mapCreateResponse(output)))
      } catch (error) {
        if (error instanceof DomainError && error.code === 'VALIDATION_ERROR') {
          return await reply.status(400).send(fail('VALIDATION_ERROR', error.message))
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )

  app.post<{ Params: CreateAvatarRequestParams; Body: CreateAvatarRequestBody }>(
    '/:scenarioId/avatars',
    {
      schema: {
        params: createAvatarParamsSchema,
        body: createAvatarBodySchema,
      },
      preHandler: authenticateApiKey(options.config.apiKeySecret),
    },
    async (request, reply) => {
      try {
        const output = await createAvatarUseCase.execute(
          mapCreateAvatarInput(request.params.scenarioId, request.body),
        )
        return await reply
          .status(201)
          .send(ok<CreateAvatarResponse>(mapCreateAvatarResponse(output)))
      } catch (error) {
        if (error instanceof DomainError) {
          if (error.code === 'NOT_FOUND') {
            return await reply.status(404).send(fail('NOT_FOUND', error.message))
          }
          if (error.code === 'VALIDATION_ERROR') {
            return await reply.status(400).send(fail('VALIDATION_ERROR', error.message))
          }
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}

function mapCreateInput(body: CreateScenarioRequestBody): CreateScenarioInput {
  return {
    name: body.name,
    slug: body.slug,
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
  }
}

function mapCreateResponse(output: CreateScenarioOutput): CreateScenarioResponse {
  return {
    scenario: {
      scenarioId: output.scenario.scenarioId,
      name: output.scenario.name,
      slug: output.scenario.slug,
      status: output.scenario.status,
      config: output.scenario.config,
      createdAt: output.scenario.createdAt,
      updatedAt: output.scenario.updatedAt,
    },
  }
}

function mapCreateAvatarInput(
  scenarioId: string,
  body: CreateAvatarRequestBody,
): CreateAvatarInput {
  return {
    scenarioId,
    name: body.name,
    slug: body.slug,
    personaPrompt: body.personaPrompt,
    ...(body.tone !== undefined ? { tone: body.tone } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.adjustments !== undefined ? { adjustments: body.adjustments } : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  }
}

function mapCreateAvatarResponse(output: CreateAvatarOutput): CreateAvatarResponse {
  return {
    avatar: {
      avatarId: output.avatar.avatarId,
      scenarioId: output.avatar.scenarioId,
      name: output.avatar.name,
      slug: output.avatar.slug,
      status: output.avatar.status,
      personaPrompt: output.avatar.personaPrompt,
      ...(output.avatar.tone !== undefined ? { tone: output.avatar.tone } : {}),
      ...(output.avatar.description !== undefined
        ? { description: output.avatar.description }
        : {}),
      ...(output.avatar.adjustments !== undefined
        ? { adjustments: output.avatar.adjustments }
        : {}),
      createdAt: output.avatar.createdAt,
      updatedAt: output.avatar.updatedAt,
    },
  }
}
