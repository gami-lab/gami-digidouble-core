import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
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
import { DomainError } from '../../domain/errors.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import type { ISessionMemoryRepository } from '../../application/ports/ISessionMemoryRepository.js'
import type { IAvatarSessionMemoryRepository } from '../../application/ports/IAvatarSessionMemoryRepository.js'

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
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          return await reply.status(404).send(fail('NOT_FOUND', error.message))
        }
        app.log.error({ err: error }, 'Failed to load session context')
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}
