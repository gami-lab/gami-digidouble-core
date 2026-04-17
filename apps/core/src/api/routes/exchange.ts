import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import { SendRawMessageUseCase } from '../../application/use-cases/send-raw-message/send-raw-message.use-case.js'
import type { SendRawMessageOutput } from '../../application/use-cases/send-raw-message/send-raw-message.types.js'
import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import { createLlmAdapter, LlmError } from '../../infrastructure/llm/index.js'
import { createObservabilityAdapter } from '../../infrastructure/observability/index.js'
import type { LlmConfig } from '../../infrastructure/llm/index.js'

export type ExchangeRouteOptions = {
  config: Config
  llmAdapter?: ILlmAdapter
  observabilityAdapter?: IObservabilityAdapter
}

type ExchangeRequestBody = {
  message: string
  systemPrompt?: string
}

const exchangeBodySchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 4000 },
    systemPrompt: { type: 'string', maxLength: 2000 },
  },
  additionalProperties: false,
} as const

export const exchangeRoute: FastifyPluginCallback<ExchangeRouteOptions> = (app, options) => {
  const llmConfig: LlmConfig = {
    provider: options.config.llmProvider,
    ...(options.config.openaiApiKey !== undefined
      ? { openaiApiKey: options.config.openaiApiKey }
      : {}),
    ...(options.config.anthropicApiKey !== undefined
      ? { anthropicApiKey: options.config.anthropicApiKey }
      : {}),
    ...(options.config.mistralApiKey !== undefined
      ? { mistralApiKey: options.config.mistralApiKey }
      : {}),
  }

  const llmAdapter = options.llmAdapter ?? createLlmAdapter(llmConfig)
  const observabilityAdapter =
    options.observabilityAdapter ??
    createObservabilityAdapter({
      langfusePublicKey: options.config.langfusePublicKey,
      langfuseSecretKey: options.config.langfuseSecretKey,
      langfuseHost: options.config.langfuseHost,
    })

  app.post<{ Body: ExchangeRequestBody }>(
    '/v1/exchange',
    {
      schema: { body: exchangeBodySchema },
      preHandler: authenticateApiKey(options.config.apiKeySecret),
    },
    async (request, reply) => {
      const useCase = new SendRawMessageUseCase(llmAdapter, observabilityAdapter)
      try {
        const output = await useCase.execute({
          userMessage: request.body.message,
          ...(request.body.systemPrompt !== undefined
            ? { systemPrompt: request.body.systemPrompt }
            : {}),
        })
        return await reply.send(ok<SendRawMessageOutput>(output))
      } catch (error) {
        if (error instanceof LlmError) {
          return await reply.status(502).send(fail('EXTERNAL_SERVICE_ERROR', error.message))
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}
