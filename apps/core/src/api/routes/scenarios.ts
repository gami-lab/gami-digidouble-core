import type { FastifyInstance, FastifyPluginCallback, FastifyReply } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
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
import { DeleteScenarioUseCase } from '../../application/use-cases/delete-scenario/delete-scenario.use-case.js'
import type { DeleteScenarioOutput } from '../../application/use-cases/delete-scenario/delete-scenario.types.js'
import { ListScenarioAvatarsUseCase } from '../../application/use-cases/list-scenario-avatars/list-scenario-avatars.use-case.js'
import type { ListScenarioAvatarsOutput } from '../../application/use-cases/list-scenario-avatars/list-scenario-avatars.types.js'
import { ListScenariosUseCase } from '../../application/use-cases/list-scenarios/list-scenarios.use-case.js'
import type { ListScenariosOutput } from '../../application/use-cases/list-scenarios/list-scenarios.types.js'
import { UpdateScenarioUseCase } from '../../application/use-cases/update-scenario/update-scenario.use-case.js'
import type { UpdateScenarioOutput } from '../../application/use-cases/update-scenario/update-scenario.types.js'
import type { AvatarStatus } from '../../domain/avatar/avatar.types.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type ScenariosRouteOptions = {
  config: Config
  scenarioRepository?: IScenarioRepository
  avatarRepository?: IAvatarRepository
  sessionRepository?: ISessionRepository
}

type ScenarioStatus = 'draft' | 'active' | 'archived'

type CreateScenarioRequestBody = {
  name: string
  status?: ScenarioStatus
  config?: Record<string, unknown>
}

type CreateScenarioResponse = {
  scenario: {
    scenarioId: string
    name: string
    status: ScenarioStatus
    config: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }
}

type CreateAvatarRequestParams = {
  scenarioId: string
}

type ListScenarioAvatarsRequestParams = {
  scenarioId: string
}

type DeleteScenarioRequestParams = {
  scenarioId: string
}

type UpdateScenarioRequestParams = {
  scenarioId: string
}

type UpdateScenarioRequestBody = {
  name?: string
  status?: ScenarioStatus
  config?: Record<string, unknown>
}

type UpdateScenarioResponse = {
  scenario: {
    scenarioId: string
    name: string
    status: ScenarioStatus
    config: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }
}

type CreateAvatarRequestBody = {
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarStatus
  availabilityKey?: string
}

type CreateAvatarResponse = {
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
    availabilityKey?: string
    createdAt: string
    updatedAt: string
  }
}

type ListScenariosResponse = ListScenariosOutput
type ListScenarioAvatarsResponse = ListScenarioAvatarsOutput
type DeleteScenarioResponse = DeleteScenarioOutput
type PatchScenarioResponse = UpdateScenarioResponse

const createScenarioBodySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['draft', 'active', 'archived'] },
    config: { type: 'object' },
  },
  additionalProperties: false,
} as const

// All fields are optional — the empty-body guard (at least one field required)
// is enforced in UpdateScenarioUseCase, not at the schema level.
const updateScenarioBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['draft', 'active', 'archived'] },
    config: { type: 'object' },
  },
  additionalProperties: false,
} as const

const scenarioIdParamsSchema = {
  type: 'object',
  required: ['scenarioId'],
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const createAvatarBodySchema = {
  type: 'object',
  required: ['name', 'personaPrompt'],
  properties: {
    name: { type: 'string', minLength: 1 },
    personaPrompt: { type: 'string', minLength: 1 },
    tone: { type: 'string' },
    description: { type: 'string' },
    adjustments: {
      type: 'array',
      items: { type: 'string' },
    },
    config: { type: 'object' },
    status: { type: 'string', enum: ['draft', 'active', 'archived'] },
    availabilityKey: { type: 'string' },
  },
  additionalProperties: false,
} as const

export const scenariosRoute: FastifyPluginCallback<ScenariosRouteOptions> = (app, options) => {
  const scenarioRepository = options.scenarioRepository ?? new InMemoryScenarioRepository()
  const avatarRepository = options.avatarRepository ?? new InMemoryAvatarRepository()
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository()
  const createScenarioUseCase = new CreateScenarioUseCase(scenarioRepository)
  const createAvatarUseCase = new CreateAvatarUseCase(scenarioRepository, avatarRepository)
  const listScenariosUseCase = new ListScenariosUseCase(scenarioRepository)
  const listScenarioAvatarsUseCase = new ListScenarioAvatarsUseCase(
    scenarioRepository,
    avatarRepository,
  )
  const deleteScenarioUseCase = new DeleteScenarioUseCase(
    scenarioRepository,
    avatarRepository,
    sessionRepository,
  )
  const updateScenarioUseCase = new UpdateScenarioUseCase(scenarioRepository)

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  registerListScenariosRoute(app, listScenariosUseCase)
  registerCreateScenarioRoute(app, createScenarioUseCase)
  registerCreateAvatarRoute(app, createAvatarUseCase)
  registerListScenarioAvatarsRoute(app, listScenarioAvatarsUseCase)
  registerDeleteScenarioRoute(app, deleteScenarioUseCase)
  registerUpdateScenarioRoute(app, updateScenarioUseCase)
}

function registerListScenariosRoute(app: FastifyInstance, useCase: ListScenariosUseCase): void {
  app.get('/', async (_request, reply) => {
    try {
      const output = await useCase.execute()
      return await reply.send(ok<ListScenariosResponse>(output))
    } catch (error) {
      app.log.error({ error }, 'Failed to list scenarios.')
      return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
    }
  })
}

function registerCreateScenarioRoute(app: FastifyInstance, useCase: CreateScenarioUseCase): void {
  app.post<{ Body: CreateScenarioRequestBody }>(
    '/',
    { schema: { body: createScenarioBodySchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute(mapCreateInput(request.body))
        return await reply.status(201).send(ok<CreateScenarioResponse>(mapCreateResponse(output)))
      } catch (error) {
        return handleDomainError(error, reply)
      }
    },
  )
}

function registerCreateAvatarRoute(app: FastifyInstance, useCase: CreateAvatarUseCase): void {
  app.post<{ Params: CreateAvatarRequestParams; Body: CreateAvatarRequestBody }>(
    '/:scenarioId/avatars',
    {
      schema: {
        params: scenarioIdParamsSchema,
        body: createAvatarBodySchema,
      },
    },
    async (request, reply) => {
      try {
        const output = await useCase.execute(
          mapCreateAvatarInput(request.params.scenarioId, request.body),
        )
        return await reply
          .status(201)
          .send(ok<CreateAvatarResponse>(mapCreateAvatarResponse(output)))
      } catch (error) {
        return handleDomainError(error, reply)
      }
    },
  )
}

function registerListScenarioAvatarsRoute(
  app: FastifyInstance,
  useCase: ListScenarioAvatarsUseCase,
): void {
  app.get<{ Params: ListScenarioAvatarsRequestParams }>(
    '/:scenarioId/avatars',
    { schema: { params: scenarioIdParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ scenarioId: request.params.scenarioId })
        return await reply.send(ok<ListScenarioAvatarsResponse>(output))
      } catch (error) {
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          return await reply.status(404).send(fail('NOT_FOUND', error.message))
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}

function registerDeleteScenarioRoute(app: FastifyInstance, useCase: DeleteScenarioUseCase): void {
  app.delete<{ Params: DeleteScenarioRequestParams }>(
    '/:scenarioId',
    { schema: { params: scenarioIdParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ scenarioId: request.params.scenarioId })
        return await reply.send(ok<DeleteScenarioResponse>(output))
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
}

function registerUpdateScenarioRoute(app: FastifyInstance, useCase: UpdateScenarioUseCase): void {
  app.patch<{ Params: UpdateScenarioRequestParams; Body: UpdateScenarioRequestBody }>(
    '/:scenarioId',
    { schema: { params: scenarioIdParamsSchema, body: updateScenarioBodySchema } },
    async (request, reply) => {
      try {
        const { name, status, config } = request.body
        const output = await useCase.execute({
          scenarioId: request.params.scenarioId,
          ...(name !== undefined ? { name } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(config !== undefined ? { config } : {}),
        })
        return await reply.send(ok<PatchScenarioResponse>(mapUpdateResponse(output)))
      } catch (error) {
        return handleDomainError(error, reply)
      }
    },
  )
}

async function handleDomainError(error: unknown, reply: FastifyReply): Promise<FastifyReply> {
  if (error instanceof DomainError) {
    if (error.code === 'VALIDATION_ERROR' || error.code === 'INVALID_INPUT') {
      return await reply.status(400).send(fail('VALIDATION_ERROR', error.message))
    }
    if (error.code === 'NOT_FOUND') {
      return await reply.status(404).send(fail('NOT_FOUND', error.message))
    }
    if (error.code === 'CONFLICT') {
      return await reply.status(409).send(fail('CONFLICT', error.message))
    }
    if (
      error.code === 'EXTERNAL_SERVICE_ERROR' ||
      error.code === 'PROVIDER_ERROR' ||
      error.code === 'TIMEOUT'
    ) {
      return await reply.status(502).send(fail('EXTERNAL_SERVICE_ERROR', error.message))
    }
  }
  return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
}

function mapCreateInput(body: CreateScenarioRequestBody): CreateScenarioInput {
  return {
    name: body.name,
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
  }
}

function mapCreateResponse(output: CreateScenarioOutput): CreateScenarioResponse {
  return {
    scenario: {
      scenarioId: output.scenario.scenarioId,
      name: output.scenario.name,
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
    personaPrompt: body.personaPrompt,
    ...(body.tone !== undefined ? { tone: body.tone } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.adjustments !== undefined ? { adjustments: body.adjustments } : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.availabilityKey !== undefined ? { availabilityKey: body.availabilityKey } : {}),
  }
}

function mapCreateAvatarResponse(output: CreateAvatarOutput): CreateAvatarResponse {
  return {
    avatar: {
      avatarId: output.avatar.avatarId,
      scenarioId: output.avatar.scenarioId,
      name: output.avatar.name,
      status: output.avatar.status,
      personaPrompt: output.avatar.personaPrompt,
      ...(output.avatar.tone !== undefined ? { tone: output.avatar.tone } : {}),
      ...(output.avatar.description !== undefined
        ? { description: output.avatar.description }
        : {}),
      ...(output.avatar.adjustments !== undefined
        ? { adjustments: output.avatar.adjustments }
        : {}),
      config: output.avatar.config,
      ...(output.avatar.availabilityKey !== undefined
        ? { availabilityKey: output.avatar.availabilityKey }
        : {}),
      createdAt: output.avatar.createdAt,
      updatedAt: output.avatar.updatedAt,
    },
  }
}

function mapUpdateResponse(output: UpdateScenarioOutput): UpdateScenarioResponse {
  return {
    scenario: {
      scenarioId: output.scenario.scenarioId,
      name: output.scenario.name,
      status: output.scenario.status,
      config: output.scenario.config as Record<string, unknown>,
      createdAt: output.scenario.createdAt,
      updatedAt: output.scenario.updatedAt,
    },
  }
}
