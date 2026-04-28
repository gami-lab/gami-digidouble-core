import type { FastifyInstance, FastifyPluginCallback, FastifyReply } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IGmStateRepository } from '../../application/ports/IGmStateRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import { InspectSessionUseCase } from '../../application/use-cases/inspect-session/inspect-session.use-case.js'
import type { InspectSessionOutput } from '../../application/use-cases/inspect-session/inspect-session.types.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryGmStateRepository } from '../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type AdminSessionsRouteOptions = {
  config: Config
  sessionRepository?: ISessionRepository
  gmStateRepository?: IGmStateRepository
  conversationRepository?: IConversationRepository
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

export const adminSessionsRoute: FastifyPluginCallback<AdminSessionsRouteOptions> = (
  app,
  options,
) => {
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository()
  const gmStateRepository = options.gmStateRepository ?? new InMemoryGmStateRepository()
  const conversationRepository =
    options.conversationRepository ?? new InMemoryConversationRepository()
  const inspectSessionUseCase = new InspectSessionUseCase(
    sessionRepository,
    gmStateRepository,
    conversationRepository,
  )

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))
  registerInspectSessionRoute(app, inspectSessionUseCase)
}

function registerInspectSessionRoute(app: FastifyInstance, useCase: InspectSessionUseCase): void {
  app.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/inspect',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<InspectSessionOutput>(output))
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

  return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
}
