import type { FastifyInstance, FastifyPluginCallback, FastifyReply } from 'fastify'
import { fail, ok } from '@gami/shared'
import type {
  CreateAvatarRequest,
  CreateAvatarResponse,
  CreateScenarioRequest,
  CreateScenarioResponse,
  GetScenarioResponse,
  UpdateScenarioRequest,
  UpdateScenarioResponse,
} from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import { CreateAvatarUseCase } from '../../application/use-cases/create-avatar/create-avatar.use-case.js'
import type { CreateAvatarOutput } from '../../application/use-cases/create-avatar/create-avatar.types.js'
import { CreateScenarioUseCase } from '../../application/use-cases/create-scenario/create-scenario.use-case.js'
import type { CreateScenarioOutput } from '../../application/use-cases/create-scenario/create-scenario.types.js'
import { DeleteScenarioUseCase } from '../../application/use-cases/delete-scenario/delete-scenario.use-case.js'
import type { DeleteScenarioOutput } from '../../application/use-cases/delete-scenario/delete-scenario.types.js'
import { GetScenarioUseCase } from '../../application/use-cases/get-scenario/get-scenario.use-case.js'
import type { GetScenarioOutput } from '../../application/use-cases/get-scenario/get-scenario.types.js'
import { ListScenarioAvatarsUseCase } from '../../application/use-cases/list-scenario-avatars/list-scenario-avatars.use-case.js'
import type { ListScenarioAvatarsOutput } from '../../application/use-cases/list-scenario-avatars/list-scenario-avatars.types.js'
import { ListScenariosUseCase } from '../../application/use-cases/list-scenarios/list-scenarios.use-case.js'
import type { ListScenariosOutput } from '../../application/use-cases/list-scenarios/list-scenarios.types.js'
import { UpdateScenarioUseCase } from '../../application/use-cases/update-scenario/update-scenario.use-case.js'
import type { UpdateScenarioOutput } from '../../application/use-cases/update-scenario/update-scenario.types.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import {
  mapCreateAvatarInput,
  mapCreateScenarioInput,
  mapUpdateScenarioInput,
} from './model-selection-mappers.js'
import {
  validateAvatarLlmOverride,
  validateScenarioModelSelection,
} from './model-selection-validation.js'

export type ScenariosRouteOptions = {
  config: Config
  scenarioRepository?: IScenarioRepository
  avatarRepository?: IAvatarRepository
  sessionRepository?: ISessionRepository
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

type GetScenarioRequestParams = {
  scenarioId: string
}

type UpdateScenarioRequestParams = {
  scenarioId: string
}

type ListScenariosResponse = ListScenariosOutput
type ListScenarioAvatarsResponse = ListScenarioAvatarsOutput
type DeleteScenarioResponse = DeleteScenarioOutput

const avatarAvailabilityBodySchema = {
  type: 'object',
  required: ['initialAvatarIds'],
  properties: {
    initialAvatarIds: { type: 'array', items: { type: 'string' } },
    unlockableAvatarIds: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
} as const

const createScenarioBodySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['draft', 'active', 'archived'] },
    objectives: { type: 'array', items: { type: 'string' } },
    worldContext: { type: 'string' },
    avatarAvailability: avatarAvailabilityBodySchema,
    modelSelection: {
      type: 'object',
      properties: {
        defaultProfile: {
          type: 'object',
          required: ['provider', 'model'],
          properties: {
            provider: { type: 'string' },
            model: { type: 'string' },
          },
          additionalProperties: false,
        },
        gameMasterOverride: {
          type: 'object',
          required: ['provider', 'model'],
          properties: {
            provider: { type: 'string' },
            model: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
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
    objectives: { type: 'array', items: { type: 'string' } },
    worldContext: { type: 'string' },
    avatarAvailability: avatarAvailabilityBodySchema,
    modelSelection: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            defaultProfile: {
              type: 'object',
              required: ['provider', 'model'],
              properties: {
                provider: { type: 'string' },
                model: { type: 'string' },
              },
              additionalProperties: false,
            },
            gameMasterOverride: {
              type: 'object',
              required: ['provider', 'model'],
              properties: {
                provider: { type: 'string' },
                model: { type: 'string' },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      ],
    },
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
  const getScenarioUseCase = new GetScenarioUseCase(scenarioRepository)

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  registerListScenariosRoute(app, listScenariosUseCase)
  registerCreateScenarioRoute(app, createScenarioUseCase)
  registerGetScenarioRoute(app, getScenarioUseCase)
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
  app.post<{ Body: CreateScenarioRequest }>(
    '/',
    { schema: { body: createScenarioBodySchema } },
    async (request, reply) => {
      try {
        const body: CreateScenarioRequest = request.body
        const validationError = validateScenarioModelSelection(body.modelSelection)
        if (validationError !== null) {
          return await reply.status(400).send(fail('VALIDATION_ERROR', validationError))
        }

        const output = await useCase.execute(mapCreateScenarioInput(body))
        return await reply.status(201).send(ok<CreateScenarioResponse>(mapCreateResponse(output)))
      } catch (error) {
        return handleDomainError(error, reply)
      }
    },
  )
}

function registerGetScenarioRoute(app: FastifyInstance, useCase: GetScenarioUseCase): void {
  app.get<{ Params: GetScenarioRequestParams }>(
    '/:scenarioId',
    { schema: { params: scenarioIdParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ scenarioId: request.params.scenarioId })
        return await reply.send(ok<GetScenarioResponse>(mapGetScenarioResponse(output)))
      } catch (error) {
        return handleDomainError(error, reply)
      }
    },
  )
}

function registerCreateAvatarRoute(app: FastifyInstance, useCase: CreateAvatarUseCase): void {
  app.post<{ Params: CreateAvatarRequestParams; Body: CreateAvatarRequest }>(
    '/:scenarioId/avatars',
    {
      schema: {
        params: scenarioIdParamsSchema,
        body: createAvatarBodySchema,
      },
    },
    async (request, reply) => {
      try {
        const validationError = validateAvatarLlmOverride(request.body.llmOverride)
        if (validationError !== null) {
          return await reply.status(400).send(fail('VALIDATION_ERROR', validationError))
        }

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
  app.patch<{ Params: UpdateScenarioRequestParams; Body: UpdateScenarioRequest }>(
    '/:scenarioId',
    { schema: { params: scenarioIdParamsSchema, body: updateScenarioBodySchema } },
    async (request, reply) => {
      try {
        const validationError = validateScenarioModelSelection(request.body.modelSelection)
        if (validationError !== null) {
          return await reply.status(400).send(fail('VALIDATION_ERROR', validationError))
        }

        const output = await useCase.execute(
          mapUpdateScenarioInput(request.params.scenarioId, request.body),
        )
        return await reply.send(ok<UpdateScenarioResponse>(mapUpdateResponse(output)))
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

function mapCreateResponse(output: CreateScenarioOutput): CreateScenarioResponse {
  return {
    scenario: {
      scenarioId: output.scenario.scenarioId,
      name: output.scenario.name,
      status: output.scenario.status,
      objectives: output.scenario.objectives,
      worldContext: output.scenario.worldContext,
      avatarAvailability: output.scenario.avatarAvailability,
      ...(output.scenario.modelSelection !== undefined
        ? { modelSelection: output.scenario.modelSelection }
        : {}),
      config: output.scenario.config,
      createdAt: output.scenario.createdAt,
      updatedAt: output.scenario.updatedAt,
    },
  }
}

function mapCreateAvatarResponse(output: CreateAvatarOutput): CreateAvatarResponse {
  return { avatar: output.avatar }
}

function mapGetScenarioResponse(output: GetScenarioOutput): GetScenarioResponse {
  return {
    scenario: {
      scenarioId: output.scenario.scenarioId,
      name: output.scenario.name,
      status: output.scenario.status,
      objectives: output.scenario.objectives,
      worldContext: output.scenario.worldContext,
      avatarAvailability: output.scenario.avatarAvailability,
      ...(output.scenario.modelSelection !== undefined
        ? { modelSelection: output.scenario.modelSelection }
        : {}),
      config: output.scenario.config as Record<string, unknown>,
      createdAt: output.scenario.createdAt,
      updatedAt: output.scenario.updatedAt,
    },
  }
}

function mapUpdateResponse(output: UpdateScenarioOutput): UpdateScenarioResponse {
  return {
    scenario: {
      scenarioId: output.scenario.scenarioId,
      name: output.scenario.name,
      status: output.scenario.status,
      objectives: output.scenario.objectives,
      worldContext: output.scenario.worldContext,
      avatarAvailability: output.scenario.avatarAvailability,
      ...(output.scenario.modelSelection !== undefined
        ? { modelSelection: output.scenario.modelSelection }
        : {}),
      config: output.scenario.config as Record<string, unknown>,
      createdAt: output.scenario.createdAt,
      updatedAt: output.scenario.updatedAt,
    },
  }
}
