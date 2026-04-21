import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IMessageRepository } from '../../application/ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import { GetHistoryUseCase } from '../../application/use-cases/get-history/get-history.use-case.js'
import type { GetHistoryOutput } from '../../application/use-cases/get-history/get-history.types.js'
import { ResetSessionUseCase } from '../../application/use-cases/reset-session/reset-session.use-case.js'
import type { ResetSessionOutput } from '../../application/use-cases/reset-session/reset-session.types.js'
import { StartSessionUseCase } from '../../application/use-cases/start-session/start-session.use-case.js'
import type { StartSessionOutput } from '../../application/use-cases/start-session/start-session.types.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type ConversationsRouteOptions = {
  config: Config
  scenarioRepository?: IScenarioRepository
  sessionRepository?: ISessionRepository
  messageRepository?: IMessageRepository
}

type StartSessionRequestBody = {
  userId: string
  scenarioId: string
}

type SessionParams = {
  sessionId: string
}

type StartSessionResponse = StartSessionOutput
type GetHistoryResponse = GetHistoryOutput
type ResetSessionResponse = ResetSessionOutput

const startSessionBodySchema = {
  type: 'object',
  required: ['userId', 'scenarioId'],
  properties: {
    userId: { type: 'string', minLength: 1 },
    scenarioId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const sessionParamsSchema = {
  type: 'object',
  required: ['sessionId'],
  properties: {
    sessionId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

export const conversationsRoute: FastifyPluginCallback<ConversationsRouteOptions> = (
  app,
  options,
) => {
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository()
  const scenarioRepository = options.scenarioRepository ?? new InMemoryScenarioRepository()
  const messageRepository = options.messageRepository ?? new InMemoryMessageRepository()

  const startSessionUseCase = new StartSessionUseCase(sessionRepository, scenarioRepository)
  const getHistoryUseCase = new GetHistoryUseCase(sessionRepository, messageRepository)
  const resetSessionUseCase = new ResetSessionUseCase(sessionRepository, messageRepository)

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.post<{ Body: StartSessionRequestBody }>(
    '/start',
    { schema: { body: startSessionBodySchema } },
    async (request, reply) => {
      try {
        const output = await startSessionUseCase.execute({
          userId: request.body.userId,
          scenarioId: request.body.scenarioId,
        })
        return await reply.status(201).send(ok<StartSessionResponse>(output))
      } catch (error) {
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
    },
  )

  app.get<{ Params: SessionParams }>(
    '/:sessionId/history',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await getHistoryUseCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<GetHistoryResponse>(output))
      } catch (error) {
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          return await reply.status(404).send(fail('NOT_FOUND', error.message))
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )

  app.delete<{ Params: SessionParams }>(
    '/:sessionId',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await resetSessionUseCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<ResetSessionResponse>(output))
      } catch (error) {
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          return await reply.status(404).send(fail('NOT_FOUND', error.message))
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}
