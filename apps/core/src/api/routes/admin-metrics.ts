import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import { GetTurnMetricsUseCase } from '../../application/use-cases/get-turn-metrics/get-turn-metrics.use-case.js'
import type { Config } from '../../config.js'
import type { TurnMetricsReport } from '../../domain/metrics/index.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type AdminMetricsRouteOptions = {
  config: Config
  sessionRepository: ISessionRepository
  eventLogRepository: IEventLogRepository
}

type SessionParams = {
  sessionId: string
}

const sessionParamsSchema = {
  type: 'object',
  required: ['sessionId'],
  properties: {
    sessionId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

export const adminMetricsRoute: FastifyPluginCallback<AdminMetricsRouteOptions> = (
  app,
  options,
) => {
  const getTurnMetricsUseCase = new GetTurnMetricsUseCase(options.eventLogRepository)
  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/metrics',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      const session = await options.sessionRepository.findById(request.params.sessionId)
      if (session === null) {
        return await reply
          .status(404)
          .send(fail('NOT_FOUND', `Session ${request.params.sessionId} was not found.`))
      }

      const report = await getTurnMetricsUseCase.execute({ sessionId: request.params.sessionId })
      return await reply.status(200).send(ok<TurnMetricsReport>(report))
    },
  )
}
