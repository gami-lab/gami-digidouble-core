import type { FastifyInstance, FastifyPluginCallback } from 'fastify'
import { ok } from '@gami/shared'
import type { AdminSessionEventsResponse, AdminSessionInspectResponse } from '@gami/shared'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../../application/ports/IGmStateRepository.js'
import type { IModelConfigRepository } from '../../application/ports/IModelConfigRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import { InspectSessionUseCase } from '../../application/use-cases/inspect-session/inspect-session.use-case.js'
import { ListSessionEventsUseCase } from '../../application/use-cases/list-session-events/list-session-events.use-case.js'
import type { Config } from '../../config.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryGmStateRepository } from '../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryModelConfigRepository } from '../../infrastructure/db/in-memory-model-config.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import {
  mapInspectorDomainError,
  sessionParamsSchema,
  type SessionParams,
} from './inspector-route-utils.js'

export type AdminSessionsRouteOptions = {
  config: Config
  sessionRepository?: ISessionRepository
  gmStateRepository?: IGmStateRepository
  conversationRepository?: IConversationRepository
  eventLogRepository?: IEventLogRepository
  avatarRepository?: IAvatarRepository
  modelConfigRepository?: IModelConfigRepository
  scenarioRepository?: IScenarioRepository
}

type SessionEventsQuerystring = {
  limit?: number
}

const sessionEventsQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
} as const

export const adminSessionsRoute: FastifyPluginCallback<AdminSessionsRouteOptions> = (
  app,
  options,
) => {
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository()
  const gmStateRepository = options.gmStateRepository ?? new InMemoryGmStateRepository()
  const conversationRepository =
    options.conversationRepository ?? new InMemoryConversationRepository()
  const eventLogRepository = options.eventLogRepository ?? new InMemoryEventLogRepository()
  const avatarRepository = options.avatarRepository ?? new InMemoryAvatarRepository()
  const modelConfigRepository = options.modelConfigRepository ?? new InMemoryModelConfigRepository()
  const scenarioRepository = options.scenarioRepository ?? new InMemoryScenarioRepository()
  const inspectSessionUseCase = new InspectSessionUseCase(
    sessionRepository,
    gmStateRepository,
    conversationRepository,
    avatarRepository,
    modelConfigRepository,
    scenarioRepository,
  )
  const listSessionEventsUseCase = new ListSessionEventsUseCase(
    sessionRepository,
    eventLogRepository,
  )

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))
  registerInspectSessionRoute(app, inspectSessionUseCase)
  registerListSessionEventsRoute(app, listSessionEventsUseCase)
}

function registerInspectSessionRoute(app: FastifyInstance, useCase: InspectSessionUseCase): void {
  app.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/inspect',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<AdminSessionInspectResponse>(output))
      } catch (error) {
        return await mapInspectorDomainError(error, reply)
      }
    },
  )
}

function registerListSessionEventsRoute(
  app: FastifyInstance,
  useCase: ListSessionEventsUseCase,
): void {
  app.get<{ Params: SessionParams; Querystring: SessionEventsQuerystring }>(
    '/sessions/:sessionId/events',
    { schema: { params: sessionParamsSchema, querystring: sessionEventsQuerySchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({
          sessionId: request.params.sessionId,
          ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
        })
        return await reply.send(ok<AdminSessionEventsResponse>(output))
      } catch (error) {
        return await mapInspectorDomainError(error, reply)
      }
    },
  )
}
