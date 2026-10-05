import type { FastifyPluginCallback } from 'fastify'
import {
  ok,
  TEXT_TO_SPEECH_PROVIDER_NAMES,
  type ListVoicesResponse,
  type TextToSpeechProviderName,
} from '@gami/shared'
import type { TextToSpeechProviders } from '../../application/voice/text-to-speech-providers.js'
import { ListVoicesUseCase } from '../../application/use-cases/list-voices/list-voices.use-case.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import { handleRouteError } from './route-error.js'

export type AdminVoicesRouteOptions = {
  config: Config
  textToSpeechProviders: TextToSpeechProviders
}

type ListVoicesQuery = { language?: string; provider?: TextToSpeechProviderName }

const querySchema = {
  type: 'object',
  properties: {
    language: { type: 'string', minLength: 1, maxLength: 35 },
    provider: { type: 'string', enum: TEXT_TO_SPEECH_PROVIDER_NAMES },
  },
  additionalProperties: false,
} as const

export const adminVoicesRoute: FastifyPluginCallback<AdminVoicesRouteOptions> = (app, options) => {
  const useCase = new ListVoicesUseCase(options.textToSpeechProviders)
  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.get<{ Querystring: ListVoicesQuery }>(
    '/voices',
    { schema: { querystring: querySchema } },
    async (request, reply) => {
      try {
        const { language, provider } = request.query
        const output = await useCase.execute({
          ...(language === undefined ? {} : { language }),
          ...(provider === undefined ? {} : { provider }),
        })
        return await reply.send(ok<ListVoicesResponse>(output))
      } catch (error) {
        const mapped = handleRouteError(error)
        return await reply.status(mapped.statusCode).send(mapped.body)
      }
    },
  )
}
