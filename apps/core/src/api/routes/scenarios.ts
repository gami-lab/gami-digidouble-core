import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import { CreateScenarioUseCase } from '../../application/use-cases/create-scenario/create-scenario.use-case.js'
import type {
  CreateScenarioInput,
  CreateScenarioOutput,
} from '../../application/use-cases/create-scenario/create-scenario.types.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type ScenariosRouteOptions = {
  config: Config
  scenarioRepository?: IScenarioRepository
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

export const scenariosRoute: FastifyPluginCallback<ScenariosRouteOptions> = (app, options) => {
  const scenarioRepository = options.scenarioRepository ?? new InMemoryScenarioRepository()
  const createScenarioUseCase = new CreateScenarioUseCase(scenarioRepository)

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
