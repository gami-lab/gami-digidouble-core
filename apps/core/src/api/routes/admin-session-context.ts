import type { FastifyPluginCallback } from 'fastify'
import { ok } from '@gami/shared'
import type { AdminSessionContextResponse } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IMessageRepository } from '../../application/ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../application/ports/IConversationWorkingMemoryRepository.js'
import { GetSessionContextUseCase } from '../../application/use-cases/get-session-context/get-session-context.use-case.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import { toAdminSessionContextResponse } from './mappers/session-context.mapper.js'
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
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
}

export const adminSessionContextRoute: FastifyPluginCallback<AdminSessionContextRouteOptions> = (
  app,
  options,
) => {
  const useCase = new GetSessionContextUseCase(
    options.sessionRepository,
    options.conversationRepository,
    options.avatarRepository,
    options.scenarioRepository,
    options.messageRepository,
    options.conversationWorkingMemoryRepository,
  )

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/context',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply
          .status(200)
          .send(ok<AdminSessionContextResponse>(toAdminSessionContextResponse(output)))
      } catch (error) {
        return await mapInspectorDomainError(error, reply, {
          internalLogMessage: 'Failed to load session context',
        })
      }
    },
  )
}
