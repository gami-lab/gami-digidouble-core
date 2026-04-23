import type { FastifyPluginCallback, FastifyReply } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import { GetSessionUseCase } from '../../application/use-cases/get-session/get-session.use-case.js'
import type { GetSessionOutput } from '../../application/use-cases/get-session/get-session.types.js'
import { ListSessionConversationsUseCase } from '../../application/use-cases/list-session-conversations/list-session-conversations.use-case.js'
import type { ListSessionConversationsOutput } from '../../application/use-cases/list-session-conversations/list-session-conversations.types.js'
import { StartConversationUseCase } from '../../application/use-cases/start-conversation/start-conversation.use-case.js'
import type { StartConversationOutput } from '../../application/use-cases/start-conversation/start-conversation.types.js'
import { StartSessionUseCase } from '../../application/use-cases/start-session/start-session.use-case.js'
import type { StartSessionOutput } from '../../application/use-cases/start-session/start-session.types.js'
import { SwitchAvatarUseCase } from '../../application/use-cases/switch-avatar/switch-avatar.use-case.js'
import type { SwitchAvatarOutput } from '../../application/use-cases/switch-avatar/switch-avatar.types.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type SessionsRouteOptions = {
  config: Config
  scenarioRepository?: IScenarioRepository
  sessionRepository?: ISessionRepository
  avatarRepository?: IAvatarRepository
  conversationRepository?: IConversationRepository
}

type StartSessionRequestBody = {
  userId: string
  scenarioId: string
}

type StartConversationRequestBody = {
  avatarId: string
}

type SwitchAvatarRequestBody = {
  avatarId: string
  reason?: string
}

type SessionParams = {
  sessionId: string
}

const startSessionBodySchema = {
  type: 'object',
  required: ['userId', 'scenarioId'],
  properties: {
    userId: { type: 'string', minLength: 1 },
    scenarioId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const startConversationBodySchema = {
  type: 'object',
  required: ['avatarId'],
  properties: {
    avatarId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const switchAvatarBodySchema = {
  type: 'object',
  required: ['avatarId'],
  properties: {
    avatarId: { type: 'string', minLength: 1 },
    reason: { type: 'string', maxLength: 200 },
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

export const sessionsRoute: FastifyPluginCallback<SessionsRouteOptions> = (app, options) => {
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository()
  const scenarioRepository = options.scenarioRepository ?? new InMemoryScenarioRepository()
  const avatarRepository = options.avatarRepository ?? new InMemoryAvatarRepository()
  const conversationRepository =
    options.conversationRepository ?? new InMemoryConversationRepository()

  const startSessionUseCase = new StartSessionUseCase(sessionRepository, scenarioRepository)
  const getSessionUseCase = new GetSessionUseCase(sessionRepository)
  const startConversationUseCase = new StartConversationUseCase(
    sessionRepository,
    avatarRepository,
    conversationRepository,
  )
  const listSessionConversationsUseCase = new ListSessionConversationsUseCase(
    sessionRepository,
    conversationRepository,
  )
  const switchAvatarUseCase = new SwitchAvatarUseCase(
    sessionRepository,
    avatarRepository,
    conversationRepository,
  )

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.post<{ Body: StartSessionRequestBody }>(
    '/',
    { schema: { body: startSessionBodySchema } },
    async (request, reply) => {
      try {
        const output = await startSessionUseCase.execute({
          userId: request.body.userId,
          scenarioId: request.body.scenarioId,
        })
        return await reply.status(201).send(ok<StartSessionOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )

  app.get<{ Params: SessionParams }>(
    '/:sessionId',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await getSessionUseCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<GetSessionOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )

  app.post<{ Params: SessionParams; Body: StartConversationRequestBody }>(
    '/:sessionId/conversations',
    { schema: { params: sessionParamsSchema, body: startConversationBodySchema } },
    async (request, reply) => {
      try {
        const output = await startConversationUseCase.execute({
          sessionId: request.params.sessionId,
          avatarId: request.body.avatarId,
        })
        return await reply.status(201).send(ok<StartConversationOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )

  app.get<{ Params: SessionParams }>(
    '/:sessionId/conversations',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await listSessionConversationsUseCase.execute({
          sessionId: request.params.sessionId,
        })
        return await reply.send(ok<ListSessionConversationsOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )

  app.post<{ Params: SessionParams; Body: SwitchAvatarRequestBody }>(
    '/:sessionId/switch-avatar',
    { schema: { params: sessionParamsSchema, body: switchAvatarBodySchema } },
    async (request, reply) => {
      try {
        const output = await switchAvatarUseCase.execute({
          sessionId: request.params.sessionId,
          avatarId: request.body.avatarId,
          ...(request.body.reason !== undefined ? { reason: request.body.reason } : {}),
        })
        return await reply.status(200).send(ok<SwitchAvatarOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

async function mapDomainError(error: unknown, reply: FastifyReply): Promise<FastifyReply> {
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
  }

  return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
}
