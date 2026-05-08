import type { FastifyInstance, FastifyPluginCallback, FastifyReply } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { EndConversationResponse, LifecycleStatus } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IAvatarSessionMemoryRepository } from '../../application/ports/IAvatarSessionMemoryRepository.js'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../application/ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { ISessionMemoryRepository } from '../../application/ports/ISessionMemoryRepository.js'
import type { ISessionEventPublisher } from '../../application/ports/ISessionEventPublisher.js'
import type { IConversationWorkingMemoryRepository } from '../../application/ports/IConversationWorkingMemoryRepository.js'
import type { IConversationMemoryRepository } from '../../application/ports/IConversationMemoryRepository.js'
import { GetAvailableAvatarsUseCase } from '../../application/use-cases/get-available-avatars/get-available-avatars.use-case.js'
import type { GetAvailableAvatarsOutput } from '../../application/use-cases/get-available-avatars/get-available-avatars.types.js'
import { GetAvatarTransitionsUseCase } from '../../application/use-cases/get-avatar-transitions/get-avatar-transitions.use-case.js'
import type { GetAvatarTransitionsOutput } from '../../application/use-cases/get-avatar-transitions/get-avatar-transitions.types.js'
import { EndConversationUseCase } from '../../application/use-cases/end-conversation/end-conversation.use-case.js'
import { GetSessionUseCase } from '../../application/use-cases/get-session/get-session.use-case.js'
import type { GetSessionOutput } from '../../application/use-cases/get-session/get-session.types.js'
import { ListSessionConversationsUseCase } from '../../application/use-cases/list-session-conversations/list-session-conversations.use-case.js'
import type { ListSessionConversationsOutput } from '../../application/use-cases/list-session-conversations/list-session-conversations.types.js'
import { ListSessionsUseCase } from '../../application/use-cases/list-sessions/list-sessions.use-case.js'
import type { ListSessionsOutput } from '../../application/use-cases/list-sessions/list-sessions.types.js'
import { ResetSessionUseCase } from '../../application/use-cases/reset-session/reset-session.use-case.js'
import type { ResetSessionOutput } from '../../application/use-cases/reset-session/reset-session.types.js'
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
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemorySessionMemoryRepository } from '../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemoryAvatarSessionMemoryRepository } from '../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryConversationMemoryRepository } from '../../infrastructure/db/in-memory-conversation-memory.repository.js'
import { InMemorySessionEventPublisher } from '../../infrastructure/events/in-memory-session-event-publisher.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import { registerRuntimeEventsRoutes } from './runtime-events.js'
import { createSessionRouteUseCases } from './sessions.use-cases.js'
import { createLlmAdapter } from '../../infrastructure/llm/index.js'

export type SessionsRouteOptions = {
  config: Config
  scenarioRepository?: IScenarioRepository
  sessionRepository?: ISessionRepository
  avatarRepository?: IAvatarRepository
  conversationRepository?: IConversationRepository
  messageRepository?: IMessageRepository
  llmAdapter?: ILlmAdapter
  sessionMemoryRepository?: ISessionMemoryRepository
  avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
  conversationMemoryRepository?: IConversationMemoryRepository
  eventLogRepository?: IEventLogRepository
  sessionEventPublisher?: ISessionEventPublisher
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

type SessionConversationParams = {
  sessionId: string
  conversationId: string
}

// Explicit-only reasons — a subset of ConversationEndReason: implicit reasons (inactivity_timeout, auto_terminal_signal) must not be submitted by callers
type ExplicitEndReason = 'user_end' | 'operator_end' | 'scenario_complete' | 'safety_stop'

type EndConversationRequestBody = {
  reason?: ExplicitEndReason
}

type ListSessionsQuerystring = {
  scenarioId?: string
  userId?: string
  status?: LifecycleStatus
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

const sessionConversationParamsSchema = {
  type: 'object',
  required: ['sessionId', 'conversationId'],
  properties: {
    sessionId: { type: 'string', minLength: 1 },
    conversationId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const endConversationBodySchema = {
  type: 'object',
  properties: {
    reason: {
      type: 'string',
      enum: ['user_end', 'operator_end', 'scenario_complete', 'safety_stop'],
    },
  },
  additionalProperties: false,
} as const

const listSessionsQuerySchema = {
  type: 'object',
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
    userId: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['active', 'closed', 'archived'] },
  },
  additionalProperties: false,
} as const

export const sessionsRoute: FastifyPluginCallback<SessionsRouteOptions> = (app, options) => {
  const dependencies = resolveRouteDependencies(options)
  const {
    sessionRepository,
    scenarioRepository,
    avatarRepository,
    conversationRepository,
    messageRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    conversationWorkingMemoryRepository,
    conversationMemoryRepository,
    eventLogRepository,
    sessionEventPublisher,
  } = dependencies
  const {
    startSessionUseCase,
    getSessionUseCase,
    listSessionsUseCase,
    resetSessionUseCase,
    startConversationUseCase,
    listSessionConversationsUseCase,
    switchAvatarUseCase,
    getAvailableAvatarsUseCase,
    getAvatarTransitionsUseCase,
    getRuntimeStateUseCase,
    endConversationUseCase,
  } = createSessionRouteUseCases({
    sessionRepository,
    scenarioRepository,
    avatarRepository,
    conversationRepository,
    messageRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    conversationWorkingMemoryRepository,
    conversationMemoryRepository,
    eventLogRepository,
    sessionEventPublisher,
    llmAdapter:
      options.llmAdapter ??
      createLlmAdapter({
        provider: options.config.llmProvider,
        ...(options.config.openaiApiKey !== undefined
          ? { openaiApiKey: options.config.openaiApiKey }
          : {}),
        ...(options.config.anthropicApiKey !== undefined
          ? { anthropicApiKey: options.config.anthropicApiKey }
          : {}),
        ...(options.config.mistralApiKey !== undefined
          ? { mistralApiKey: options.config.mistralApiKey }
          : {}),
      }),
  })

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))
  registerStartSessionRoute(app, startSessionUseCase)
  registerGetSessionRoute(app, getSessionUseCase)
  registerListSessionsRoute(app, listSessionsUseCase)
  registerResetSessionRoute(app, resetSessionUseCase)
  registerStartConversationRoute(app, startConversationUseCase)
  registerListSessionConversationsRoute(app, listSessionConversationsUseCase)
  registerEndConversationRoute(app, endConversationUseCase)
  registerSwitchAvatarRoute(app, switchAvatarUseCase)
  registerGetAvailableAvatarsRoute(app, getAvailableAvatarsUseCase)
  registerGetAvatarTransitionsRoute(app, getAvatarTransitionsUseCase)
  registerRuntimeEventsRoutes(
    app,
    sessionRepository,
    sessionEventPublisher,
    getRuntimeStateUseCase,
    options.config.corsOrigin,
  )
}

function resolveRouteDependencies(options: SessionsRouteOptions) {
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository()
  const scenarioRepository = options.scenarioRepository ?? new InMemoryScenarioRepository()
  const avatarRepository = options.avatarRepository ?? new InMemoryAvatarRepository()
  const conversationRepository =
    options.conversationRepository ?? new InMemoryConversationRepository()
  const messageRepository = options.messageRepository ?? new InMemoryMessageRepository()
  const {
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    conversationWorkingMemoryRepository,
    conversationMemoryRepository,
  } = resolveWorkingMemoryRepositories(options)
  const eventLogRepository = options.eventLogRepository ?? new InMemoryEventLogRepository()
  const sessionEventPublisher = options.sessionEventPublisher ?? new InMemorySessionEventPublisher()

  return {
    sessionRepository,
    scenarioRepository,
    avatarRepository,
    conversationRepository,
    messageRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    conversationWorkingMemoryRepository,
    conversationMemoryRepository,
    eventLogRepository,
    sessionEventPublisher,
  }
}

function resolveWorkingMemoryRepositories(options: SessionsRouteOptions): {
  sessionMemoryRepository: ISessionMemoryRepository
  avatarSessionMemoryRepository: IAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository
  conversationMemoryRepository: IConversationMemoryRepository
} {
  return {
    sessionMemoryRepository:
      options.sessionMemoryRepository ?? new InMemorySessionMemoryRepository(),
    avatarSessionMemoryRepository:
      options.avatarSessionMemoryRepository ?? new InMemoryAvatarSessionMemoryRepository(),
    conversationWorkingMemoryRepository:
      options.conversationWorkingMemoryRepository ??
      new InMemoryConversationWorkingMemoryRepository(),
    conversationMemoryRepository:
      options.conversationMemoryRepository ?? new InMemoryConversationMemoryRepository(),
  }
}

function registerStartSessionRoute(app: FastifyInstance, useCase: StartSessionUseCase): void {
  app.post<{ Body: StartSessionRequestBody }>(
    '/',
    { schema: { body: startSessionBodySchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({
          userId: request.body.userId,
          scenarioId: request.body.scenarioId,
        })
        return await reply.status(201).send(ok<StartSessionOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

function registerGetSessionRoute(app: FastifyInstance, useCase: GetSessionUseCase): void {
  app.get<{ Params: SessionParams }>(
    '/:sessionId',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<GetSessionOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

function registerListSessionsRoute(app: FastifyInstance, useCase: ListSessionsUseCase): void {
  app.get<{ Querystring: ListSessionsQuerystring }>(
    '/',
    { schema: { querystring: listSessionsQuerySchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({
          ...(request.query.scenarioId !== undefined
            ? { scenarioId: request.query.scenarioId }
            : {}),
          ...(request.query.userId !== undefined ? { userId: request.query.userId } : {}),
          ...(request.query.status !== undefined ? { status: request.query.status } : {}),
        })
        return await reply.send(ok<ListSessionsOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

function registerResetSessionRoute(app: FastifyInstance, useCase: ResetSessionUseCase): void {
  app.post<{ Params: SessionParams }>(
    '/:sessionId/reset',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<ResetSessionOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

function registerStartConversationRoute(
  app: FastifyInstance,
  useCase: StartConversationUseCase,
): void {
  app.post<{ Params: SessionParams; Body: StartConversationRequestBody }>(
    '/:sessionId/conversations',
    { schema: { params: sessionParamsSchema, body: startConversationBodySchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({
          sessionId: request.params.sessionId,
          avatarId: request.body.avatarId,
        })
        return await reply.status(201).send(ok<StartConversationOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

function registerListSessionConversationsRoute(
  app: FastifyInstance,
  useCase: ListSessionConversationsUseCase,
): void {
  app.get<{ Params: SessionParams }>(
    '/:sessionId/conversations',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({
          sessionId: request.params.sessionId,
        })
        return await reply.send(ok<ListSessionConversationsOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

function registerEndConversationRoute(app: FastifyInstance, useCase: EndConversationUseCase): void {
  app.post<{ Params: SessionConversationParams; Body: EndConversationRequestBody }>(
    '/:sessionId/conversations/:conversationId/end',
    { schema: { params: sessionConversationParamsSchema, body: endConversationBodySchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({
          sessionId: request.params.sessionId,
          conversationId: request.params.conversationId,
          ...(request.body.reason !== undefined ? { reason: request.body.reason } : {}),
        })
        return await reply.send(ok<EndConversationResponse>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

function registerSwitchAvatarRoute(app: FastifyInstance, useCase: SwitchAvatarUseCase): void {
  app.post<{ Params: SessionParams; Body: SwitchAvatarRequestBody }>(
    '/:sessionId/switch-avatar',
    { schema: { params: sessionParamsSchema, body: switchAvatarBodySchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({
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

function registerGetAvailableAvatarsRoute(
  app: FastifyInstance,
  useCase: GetAvailableAvatarsUseCase,
): void {
  app.get<{ Params: SessionParams }>(
    '/:sessionId/available-avatars',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<GetAvailableAvatarsOutput>(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

function registerGetAvatarTransitionsRoute(
  app: FastifyInstance,
  useCase: GetAvatarTransitionsUseCase,
): void {
  app.get<{ Params: SessionParams }>(
    '/:sessionId/avatar-transitions',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<GetAvatarTransitionsOutput>(output))
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
    if (error.code === 'FORBIDDEN') {
      return await reply.status(403).send(fail('FORBIDDEN', error.message))
    }
  }

  return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
}
