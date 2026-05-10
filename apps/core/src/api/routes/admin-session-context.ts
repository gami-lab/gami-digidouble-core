import type { FastifyPluginCallback } from 'fastify'
import { ok } from '@gami/shared'
import type { AdminSessionContextResponse } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IGmStateRepository } from '../../application/ports/IGmStateRepository.js'
import type { IMessageRepository } from '../../application/ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { IUserMemoryFactRepository } from '../../application/ports/IUserMemoryFactRepository.js'
import type { IUserRepository } from '../../application/ports/IUserRepository.js'
import { AvatarMemoryContextAssembler } from '../../application/services/avatar-memory-context-assembler.service.js'
import { GetSessionContextUseCase } from '../../application/use-cases/get-session-context/get-session-context.use-case.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import type { ISessionMemoryRepository } from '../../application/ports/ISessionMemoryRepository.js'
import type { IAvatarSessionMemoryRepository } from '../../application/ports/IAvatarSessionMemoryRepository.js'
import {
  mapInspectorDomainError,
  sessionParamsSchema,
  type SessionParams,
} from './inspector-route-utils.js'

export type AdminSessionContextRouteOptions = {
  config: Config
  sessionRepository: ISessionRepository
  conversationRepository: IConversationRepository
  avatarRepository: IAvatarRepository
  scenarioRepository: IScenarioRepository
  messageRepository: IMessageRepository
  gmStateRepository: IGmStateRepository
  userRepository?: IUserRepository
  userMemoryFactRepository?: IUserMemoryFactRepository
  sessionMemoryRepository?: ISessionMemoryRepository
  avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository
}

export const adminSessionContextRoute: FastifyPluginCallback<AdminSessionContextRouteOptions> = (
  app,
  options,
) => {
  const memoryContextAssembler = new AvatarMemoryContextAssembler(
    options.messageRepository,
    options.sessionMemoryRepository,
    options.avatarSessionMemoryRepository,
    options.userMemoryFactRepository,
  )
  const useCase = new GetSessionContextUseCase(
    options.sessionRepository,
    options.conversationRepository,
    options.avatarRepository,
    options.scenarioRepository,
    options.messageRepository,
    options.gmStateRepository,
    options.userRepository,
    memoryContextAssembler,
  )

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/context',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.status(200).send(ok<AdminSessionContextResponse>(output))
      } catch (error) {
        return await mapInspectorDomainError(error, reply, {
          internalLogMessage: 'Failed to load session context',
        })
      }
    },
  )
}
