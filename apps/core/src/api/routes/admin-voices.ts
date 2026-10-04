import type { FastifyPluginCallback } from 'fastify'
import { ok, type ListVoicesResponse } from '@gami/shared'
import type { ITextToSpeechAdapter } from '../../application/ports/ITextToSpeechAdapter.js'
import { ListVoicesUseCase } from '../../application/use-cases/list-voices/list-voices.use-case.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import { handleRouteError } from './route-error.js'

export type AdminVoicesRouteOptions = {
  config: Config
  textToSpeechAdapter: ITextToSpeechAdapter
}

type ListVoicesQuery = { language?: string }

const querySchema = {
  type: 'object',
  properties: {
    language: { type: 'string', minLength: 1, maxLength: 35 },
  },
  additionalProperties: false,
} as const

export const adminVoicesRoute: FastifyPluginCallback<AdminVoicesRouteOptions> = (app, options) => {
  const useCase = new ListVoicesUseCase(options.textToSpeechAdapter)
  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.get<{ Querystring: ListVoicesQuery }>(
    '/voices',
    { schema: { querystring: querySchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute(
          request.query.language === undefined ? {} : { language: request.query.language },
        )
        return await reply.send(ok<ListVoicesResponse>(output))
      } catch (error) {
        const mapped = handleRouteError(error)
        return await reply.status(mapped.statusCode).send(mapped.body)
      }
    },
  )
}
