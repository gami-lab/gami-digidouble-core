import type { FastifyInstance, FastifyPluginCallback, FastifyReply } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { AvatarSummary, ScenarioAvatarAvailability, ScenarioSummary } from '@gami/shared'
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
import type { ProviderName } from '../../domain/model-config/index.js'
import { isProviderName, PROVIDER_NAMES } from '../../domain/model-config/index.js'
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

type CreateScenarioRequestBody = {
  name: string
  status?: ScenarioSummary['status']
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailability
  config?: Record<string, unknown>
}

type CreateScenarioResponse = {
  scenario: ScenarioSummary
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

type GetScenarioResponse = {
  scenario: ScenarioSummary
}

type UpdateScenarioRequestParams = {
  scenarioId: string
}

type UpdateScenarioRequestBody = {
  name?: string
  status?: ScenarioSummary['status']
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailability
  config?: Record<string, unknown>
}

type UpdateScenarioResponse = {
  scenario: ScenarioSummary
}

type CreateAvatarRequestBody = {
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: { provider?: string; model?: string } | null
  config?: Record<string, unknown>
  status?: AvatarSummary['status']
}

type CreateAvatarResponse = {
  avatar: AvatarSummary
}

type ListScenariosResponse = ListScenariosOutput
type ListScenarioAvatarsResponse = ListScenarioAvatarsOutput
type DeleteScenarioResponse = DeleteScenarioOutput
type PatchScenarioResponse = UpdateScenarioResponse

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
        const validationError = validateLlmOverride(request.body.llmOverride)
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
  app.patch<{ Params: UpdateScenarioRequestParams; Body: UpdateScenarioRequestBody }>(
    '/:scenarioId',
    { schema: { params: scenarioIdParamsSchema, body: updateScenarioBodySchema } },
    async (request, reply) => {
      try {
        const { name, status, objectives, worldContext, avatarAvailability, config } = request.body
        const output = await useCase.execute({
          scenarioId: request.params.scenarioId,
          ...(name !== undefined ? { name } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(objectives !== undefined ? { objectives } : {}),
          ...(worldContext !== undefined ? { worldContext } : {}),
          ...(avatarAvailability !== undefined ? { avatarAvailability } : {}),
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
    ...(body.objectives !== undefined ? { objectives: body.objectives } : {}),
    ...(body.worldContext !== undefined ? { worldContext: body.worldContext } : {}),
    ...(body.avatarAvailability !== undefined
      ? { avatarAvailability: body.avatarAvailability }
      : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
  }
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
  const normalizedLlmOverride = normalizeLlmOverride(body.llmOverride)
  return {
    scenarioId,
    name: body.name,
    personaPrompt: body.personaPrompt,
    ...(body.tone !== undefined ? { tone: body.tone } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.adjustments !== undefined ? { adjustments: body.adjustments } : {}),
    ...(normalizedLlmOverride !== undefined ? { llmOverride: normalizedLlmOverride } : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  }
}

function mapCreateAvatarResponse(output: CreateAvatarOutput): CreateAvatarResponse {
  return { avatar: output.avatar }
}

function validateLlmOverride(value: CreateAvatarRequestBody['llmOverride']): string | null {
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
  llmOverride: CreateAvatarRequestBody['llmOverride'],
): CreateAvatarInput['llmOverride'] {
  if (llmOverride === undefined) return undefined
  if (llmOverride === null) return null

  return {
    ...(llmOverride.provider !== undefined
      ? { provider: llmOverride.provider as ProviderName }
      : {}),
    ...(llmOverride.model !== undefined ? { model: llmOverride.model.trim() } : {}),
  }
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
      config: output.scenario.config as Record<string, unknown>,
      createdAt: output.scenario.createdAt,
      updatedAt: output.scenario.updatedAt,
    },
  }
}
