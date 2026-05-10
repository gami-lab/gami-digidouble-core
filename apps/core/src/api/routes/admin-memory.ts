import type { FastifyPluginCallback } from 'fastify'
import { ok } from '@gami/shared'
import type { AdminSessionMemoryLayersResponse, AdminSessionMemoryResponse } from '@gami/shared'
import type { IAvatarSessionMemoryRepository } from '../../application/ports/IAvatarSessionMemoryRepository.js'
import type { IConversationMemoryRepository } from '../../application/ports/IConversationMemoryRepository.js'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../application/ports/IConversationWorkingMemoryRepository.js'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import type { IMessageRepository } from '../../application/ports/IMessageRepository.js'
import type { ISessionMemoryRepository } from '../../application/ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { IUserMemoryFactRepository } from '../../application/ports/IUserMemoryFactRepository.js'
import { GetSessionMemoryUseCase } from '../../application/use-cases/get-session-memory/get-session-memory.use-case.js'
import { GetSessionMemoryLayersUseCase } from '../../application/use-cases/get-session-memory-layers/get-session-memory-layers.use-case.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import {
  mapInspectorDomainError,
  sessionParamsSchema,
  type SessionParams,
} from './inspector-route-utils.js'

export type AdminMemoryRouteOptions = {
  config: Config
  sessionRepository: ISessionRepository
  userMemoryFactRepository?: IUserMemoryFactRepository
  sessionMemoryRepository?: ISessionMemoryRepository
  avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository
  conversationRepository?: IConversationRepository
  messageRepository?: IMessageRepository
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
  conversationMemoryRepository?: IConversationMemoryRepository
  eventLogRepository?: IEventLogRepository
}

export const adminMemoryRoute: FastifyPluginCallback<AdminMemoryRouteOptions> = (app, options) => {
  const getSessionMemoryUseCase = new GetSessionMemoryUseCase(
    options.sessionRepository,
    options.userMemoryFactRepository,
    options.sessionMemoryRepository,
  )
  const getSessionMemoryLayersUseCase = new GetSessionMemoryLayersUseCase(
    options.sessionRepository,
    options.userMemoryFactRepository,
    options.sessionMemoryRepository,
    options.avatarSessionMemoryRepository,
    options.conversationRepository,
    options.messageRepository,
    options.conversationWorkingMemoryRepository,
    options.conversationMemoryRepository,
    options.eventLogRepository,
  )
  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/memory',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await getSessionMemoryUseCase.execute({
          sessionId: request.params.sessionId,
        })
        return await reply.status(200).send(
          ok<AdminSessionMemoryResponse>({
            session: output.memorySummary,
          }),
        )
      } catch (error) {
        return await mapInspectorDomainError(error, reply, {
          internalLogMessage: 'Failed to load session memory summary',
        })
      }
    },
  )

  app.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/memory-layers',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await getSessionMemoryLayersUseCase.execute({
          sessionId: request.params.sessionId,
        })
        return await reply.status(200).send(
          ok<AdminSessionMemoryLayersResponse>({
            session: output.memory,
          }),
        )
      } catch (error) {
        return await mapInspectorDomainError(error, reply, {
          internalLogMessage: 'Failed to load session memory layers',
        })
      }
    },
  )
}
