import type { FastifyPluginCallback, FastifyReply } from 'fastify'
import { fail, ok } from '@gami/shared'
import type {
  AdminClearMemoryResponse,
  AdminRefreshMemoryResponse,
  AdminReplayGmResponse,
} from '@gami/shared'
import type { IAvatarSessionMemoryRepository } from '../../application/ports/IAvatarSessionMemoryRepository.js'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../application/ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../../application/ports/IMemoryMaintenancePort.js'
import type { ISessionMemoryRepository } from '../../application/ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { IUserRepository } from '../../application/ports/IUserRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../application/ports/IConversationWorkingMemoryRepository.js'
import { MemoryMaintenanceService } from '../../application/services/memory-maintenance.service.js'
import { AdminRuntimeActionsUseCase } from '../../application/use-cases/admin-runtime-actions/admin-runtime-actions.use-case.js'
import type { RunGameMasterUseCase } from '../../application/use-cases/run-game-master/run-game-master.use-case.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import { InMemoryAvatarSessionMemoryRepository } from '../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemorySessionMemoryRepository } from '../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'

export type AdminRuntimeActionsRouteOptions = {
  config: Config
  sessionRepository: ISessionRepository
  conversationRepository: IConversationRepository
  messageRepository: IMessageRepository
  eventLogRepository: IEventLogRepository
  llmAdapter: ILlmAdapter
  runGameMasterUseCase?: RunGameMasterUseCase
  userRepository?: IUserRepository
  sessionMemoryRepository?: ISessionMemoryRepository
  avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
  memoryMaintenance?: IMemoryMaintenancePort
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

export const adminRuntimeActionsRoute: FastifyPluginCallback<AdminRuntimeActionsRouteOptions> = (
  app,
  options,
) => {
  const sessionMemoryRepository =
    options.sessionMemoryRepository ?? new InMemorySessionMemoryRepository()
  const avatarSessionMemoryRepository =
    options.avatarSessionMemoryRepository ?? new InMemoryAvatarSessionMemoryRepository()
  const conversationWorkingMemoryRepository =
    options.conversationWorkingMemoryRepository ?? new InMemoryConversationWorkingMemoryRepository()
  const memoryMaintenance =
    options.memoryMaintenance ??
    new MemoryMaintenanceService(
      options.messageRepository,
      conversationWorkingMemoryRepository,
      options.eventLogRepository,
      options.llmAdapter,
    )

  const useCase = new AdminRuntimeActionsUseCase(
    options.sessionRepository,
    options.conversationRepository,
    options.messageRepository,
    options.eventLogRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    conversationWorkingMemoryRepository,
    memoryMaintenance,
    options.runGameMasterUseCase,
    options.userRepository,
  )

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.post<{ Params: SessionParams }>(
    '/sessions/:sessionId/gm/replay',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.replayGm({ sessionId: request.params.sessionId })
        return await reply.status(200).send(ok<AdminReplayGmResponse>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )

  app.post<{ Params: SessionParams }>(
    '/sessions/:sessionId/memory/refresh',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.refreshMemory({ sessionId: request.params.sessionId })
        return await reply.status(200).send(ok<AdminRefreshMemoryResponse>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )

  app.post<{ Params: SessionParams }>(
    '/sessions/:sessionId/memory/clear',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.clearMemory({ sessionId: request.params.sessionId })
        return await reply.status(200).send(ok<AdminClearMemoryResponse>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

async function mapDomainError(error: unknown, reply: FastifyReply): Promise<FastifyReply> {
  if (error instanceof DomainError && error.code === 'NOT_FOUND') {
    return await reply.status(404).send(fail('NOT_FOUND', error.message))
  }
  if (error instanceof DomainError && error.code === 'CONFLICT') {
    return await reply.status(409).send(fail('CONFLICT', error.message))
  }
  return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
}
