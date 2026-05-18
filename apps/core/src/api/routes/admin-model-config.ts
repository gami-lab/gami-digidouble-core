import type { FastifyPluginCallback } from 'fastify'
import { fail, ok, type ModelConfigResponse } from '@gami/shared'
import type { IModelConfigRepository } from '../../application/ports/IModelConfigRepository.js'
import { GetModelConfigUseCase } from '../../application/use-cases/get-model-config/get-model-config.use-case.js'
import {
  UpdateModelConfigUseCase,
  type UpdateModelConfigInput,
} from '../../application/use-cases/update-model-config/update-model-config.use-case.js'
import type { Config } from '../../config.js'
import type { ModelConfig } from '../../domain/model-config/index.js'
import { DomainError } from '../../domain/errors.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type AdminModelConfigRouteOptions = {
  config: Config
  modelConfigRepository: IModelConfigRepository
}

type UpdateModelConfigBody = UpdateModelConfigInput

const modelOverrideSchema = {
  type: 'object',
  properties: {
    provider: { type: 'string' },
    model: { type: 'string' },
  },
  additionalProperties: false,
} as const

const updateModelConfigBodySchema = {
  type: 'object',
  required: ['globalDefault'],
  properties: {
    globalDefault: {
      type: 'object',
      required: ['provider', 'model'],
      properties: {
        provider: { type: 'string' },
        model: { type: 'string' },
      },
      additionalProperties: false,
    },
    roleOverrides: {
      type: 'object',
      properties: {
        avatar: modelOverrideSchema,
        gameMaster: modelOverrideSchema,
        memory: modelOverrideSchema,
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const

function toResponse(modelConfig: ModelConfig): ModelConfigResponse {
  return {
    globalDefault: modelConfig.globalDefault,
    roleOverrides: modelConfig.roleOverrides,
    updatedAt: modelConfig.updatedAt,
  }
}

export const adminModelConfigRoute: FastifyPluginCallback<AdminModelConfigRouteOptions> = (
  app,
  options,
) => {
  const getModelConfigUseCase = new GetModelConfigUseCase(options.modelConfigRepository)
  const updateModelConfigUseCase = new UpdateModelConfigUseCase(options.modelConfigRepository)

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.get('/model-config', async (_request, reply) => {
    const output = await getModelConfigUseCase.execute()
    return await reply.status(200).send(
      ok<{ modelConfig: ModelConfigResponse }>({
        modelConfig: toResponse(output.modelConfig),
      }),
    )
  })

  app.put<{ Body: UpdateModelConfigBody }>(
    '/model-config',
    { schema: { body: updateModelConfigBodySchema } },
    async (request, reply) => {
      try {
        const output = await updateModelConfigUseCase.execute(request.body)
        return await reply.status(200).send(
          ok<{ modelConfig: ModelConfigResponse }>({
            modelConfig: toResponse(output.modelConfig),
          }),
        )
      } catch (error) {
        if (error instanceof DomainError && error.code === 'INVALID_INPUT') {
          return await reply
            .status(400)
            .send(fail('VALIDATION_ERROR', error.message, error.details))
        }

        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}
