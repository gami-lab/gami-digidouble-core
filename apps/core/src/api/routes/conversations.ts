import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IAvatarSessionMemoryRepository } from '../../application/ports/IAvatarSessionMemoryRepository.js'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../application/ports/IMessageRepository.js'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { ISessionMemoryRepository } from '../../application/ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { IUserMemoryFactRepository } from '../../application/ports/IUserMemoryFactRepository.js'
import type { IUserRepository } from '../../application/ports/IUserRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../application/ports/IConversationWorkingMemoryRepository.js'
import type { IConversationMemoryRepository } from '../../application/ports/IConversationMemoryRepository.js'
import { GetHistoryUseCase } from '../../application/use-cases/get-history/get-history.use-case.js'
import type { RunGameMasterUseCase } from '../../application/use-cases/run-game-master/run-game-master.use-case.js'
import type { GetHistoryOutput } from '../../application/use-cases/get-history/get-history.types.js'
import { EndConversationUseCase } from '../../application/use-cases/end-conversation/end-conversation.use-case.js'
import { MemoryMaintenanceService } from '../../application/services/memory-maintenance.service.js'
import { SendMessageUseCase } from '../../application/use-cases/send-message/send-message.use-case.js'
import type { SendMessageOutput } from '../../application/use-cases/send-message/send-message.types.js'
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
import { EpisodicMemoryService } from '../../application/services/episodic-memory.service.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { InMemoryUserRepository } from '../../infrastructure/db/in-memory-user.repository.js'
import { createLlmAdapter, LlmError } from '../../infrastructure/llm/index.js'
import type { LlmConfig } from '../../infrastructure/llm/index.js'
import { createObservabilityAdapter } from '../../infrastructure/observability/index.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

type ConversationsRouteOptions = {
  config: Config
  llmAdapter?: ILlmAdapter
  observabilityAdapter?: IObservabilityAdapter
  avatarRepository?: IAvatarRepository
  scenarioRepository?: IScenarioRepository
  sessionRepository?: ISessionRepository
  conversationRepository?: IConversationRepository
  eventLogRepository?: IEventLogRepository
  messageRepository?: IMessageRepository
  runGameMasterUseCase?: RunGameMasterUseCase
  userRepository?: IUserRepository
  userMemoryFactRepository?: IUserMemoryFactRepository
  sessionMemoryRepository?: ISessionMemoryRepository
  avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
  conversationMemoryRepository?: IConversationMemoryRepository
}

type ConversationParams = { conversationId: string }

type SendMessageBody = {
  message: { content: string }
}

type SendMessageResponse = {
  conversation: {
    conversationId: string
    sessionId: string
    avatarId: string
    status: 'active' | 'closed' | 'archived'
    startedAt: string
    lastActivityAt: string
    endedAt?: string
  }
  session: {
    sessionId: string
    userId: string
    scenarioId: string
    activeAvatarId?: string
    unlockedAvatarIds?: string[]
    status: 'active' | 'closed' | 'archived'
    startedAt: string
    lastActivityAt: string
  }
  userMessage: {
    messageId: string
    conversationId: string
    role: 'user'
    content: string
    createdAt: string
  }
  avatarMessage: {
    messageId: string
    conversationId: string
    role: 'avatar'
    content: string
    createdAt: string
    metadata: {
      model: string
      latencyMs: number
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
  }
  debug: {
    requestId: string
    model: string
    latencyMs: number
    inputTokens: number
    outputTokens: number
  }
}

const conversationParamsSchema = {
  type: 'object',
  required: ['conversationId'],
  properties: {
    conversationId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const sendMessageBodySchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string', minLength: 1, maxLength: 4000 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const

export const conversationsRoute: FastifyPluginCallback<ConversationsRouteOptions> = (
  app,
  options,
) => {
  const deps = createRouteDependencies(options)
  const getHistoryUseCase = new GetHistoryUseCase(
    deps.conversationRepository,
    deps.messageRepository,
  )

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.addHook('onClose', async () => {
    await deps.observabilityAdapter.flush()
  })

  app.post<{ Params: ConversationParams; Body: SendMessageBody }>(
    '/:conversationId/messages',
    { schema: { params: conversationParamsSchema, body: sendMessageBodySchema } },
    async (request, reply) => {
      try {
        const output = await deps.sendMessageUseCase.execute({
          conversationId: request.params.conversationId,
          userMessage: request.body.message.content,
        })
        const response = mapSendMessageResponse(output)
        return await reply.send(ok<SendMessageResponse>(response))
      } catch (error) {
        const mappedError = handleRouteError(error)
        return await reply.status(mappedError.statusCode).send(mappedError.body)
      }
    },
  )

  app.get<{ Params: ConversationParams }>(
    '/:conversationId/history',
    { schema: { params: conversationParamsSchema } },
    async (request, reply) => {
      try {
        const output = await getHistoryUseCase.execute({
          conversationId: request.params.conversationId,
        })
        return await reply.send(ok<GetHistoryOutput>(output))
      } catch (error) {
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          return await reply.status(404).send(fail('NOT_FOUND', error.message))
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}

type RouteDependencies = {
  sendMessageUseCase: SendMessageUseCase
  observabilityAdapter: IObservabilityAdapter
  conversationRepository: IConversationRepository
  messageRepository: IMessageRepository
}

type ConversationPersistenceDeps = {
  avatarRepository: IAvatarRepository
  scenarioRepository: IScenarioRepository
  sessionRepository: ISessionRepository
  conversationRepository: IConversationRepository
  eventLogRepository: IEventLogRepository
  messageRepository: IMessageRepository
  userRepository: IUserRepository
  userMemoryFactRepository: IUserMemoryFactRepository
  sessionMemoryRepository: ISessionMemoryRepository
  avatarSessionMemoryRepository: IAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository
  conversationMemoryRepository: IConversationMemoryRepository
}

function createRouteDependencies(options: ConversationsRouteOptions): RouteDependencies {
  const llmAdapter = options.llmAdapter ?? createLlmAdapter(buildLlmConfig(options.config))
  const observabilityAdapter =
    options.observabilityAdapter ??
    createObservabilityAdapter({
      langfusePublicKey: options.config.langfusePublicKey,
      langfuseSecretKey: options.config.langfuseSecretKey,
      langfuseHost: options.config.langfuseHost,
    })
  const repositories = resolvePersistenceDeps(options)
  const memoryMaintenance = new MemoryMaintenanceService(
    repositories.messageRepository,
    repositories.conversationWorkingMemoryRepository,
    repositories.eventLogRepository,
    llmAdapter,
  )
  const episodicMemoryService = new EpisodicMemoryService(
    repositories.conversationMemoryRepository,
    repositories.conversationWorkingMemoryRepository,
    repositories.messageRepository,
  )

  return {
    observabilityAdapter,
    conversationRepository: repositories.conversationRepository,
    messageRepository: repositories.messageRepository,
    sendMessageUseCase: new SendMessageUseCase(
      repositories.sessionRepository,
      repositories.conversationRepository,
      repositories.avatarRepository,
      repositories.scenarioRepository,
      repositories.messageRepository,
      llmAdapter,
      repositories.eventLogRepository,
      observabilityAdapter,
      options.runGameMasterUseCase ?? null,
      repositories.userRepository,
      new EndConversationUseCase(
        repositories.sessionRepository,
        repositories.conversationRepository,
        repositories.eventLogRepository,
        memoryMaintenance,
        undefined,
        repositories.messageRepository,
        undefined,
        repositories.userMemoryFactRepository,
        episodicMemoryService,
      ),
      undefined,
      repositories.userMemoryFactRepository,
      memoryMaintenance,
      repositories.conversationWorkingMemoryRepository,
      repositories.conversationMemoryRepository,
    ),
  }
}

function resolvePersistenceDeps(options: ConversationsRouteOptions): ConversationPersistenceDeps {
  return {
    avatarRepository: options.avatarRepository ?? new InMemoryAvatarRepository(),
    scenarioRepository: options.scenarioRepository ?? new InMemoryScenarioRepository(),
    sessionRepository: options.sessionRepository ?? new InMemorySessionRepository(),
    conversationRepository: options.conversationRepository ?? new InMemoryConversationRepository(),
    eventLogRepository: options.eventLogRepository ?? new InMemoryEventLogRepository(),
    messageRepository: options.messageRepository ?? new InMemoryMessageRepository(),
    userRepository: options.userRepository ?? new InMemoryUserRepository(),
    userMemoryFactRepository:
      options.userMemoryFactRepository ?? new InMemoryUserMemoryFactRepository(),
    ...resolveWorkingMemoryDeps(options),
  }
}

function resolveWorkingMemoryDeps(options: ConversationsRouteOptions): {
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

function buildLlmConfig(config: Config): LlmConfig {
  return {
    provider: config.llmProvider,
    ...(config.openaiApiKey !== undefined ? { openaiApiKey: config.openaiApiKey } : {}),
    ...(config.anthropicApiKey !== undefined ? { anthropicApiKey: config.anthropicApiKey } : {}),
    ...(config.mistralApiKey !== undefined ? { mistralApiKey: config.mistralApiKey } : {}),
  }
}

function mapSendMessageResponse(output: SendMessageOutput): SendMessageResponse {
  return {
    conversation: {
      conversationId: output.conversation.conversationId,
      sessionId: output.conversation.sessionId,
      avatarId: output.conversation.avatarId,
      status: output.conversation.status,
      startedAt: output.conversation.startedAt,
      lastActivityAt: output.conversation.lastActivityAt,
      ...(output.conversation.endedAt !== undefined
        ? { endedAt: output.conversation.endedAt }
        : {}),
    },
    session: {
      sessionId: output.session.sessionId,
      userId: output.session.userId,
      scenarioId: output.session.scenarioId,
      ...(output.session.activeAvatarId !== undefined
        ? { activeAvatarId: output.session.activeAvatarId }
        : {}),
      ...(output.session.unlockedAvatarIds !== undefined
        ? { unlockedAvatarIds: output.session.unlockedAvatarIds }
        : {}),
      status: output.session.status,
      startedAt: output.session.startedAt,
      lastActivityAt: output.session.lastActivityAt,
    },
    userMessage: {
      messageId: output.userMessage.messageId,
      conversationId: output.conversationId,
      role: 'user',
      content: output.userMessage.content,
      createdAt: output.userMessage.createdAt,
    },
    avatarMessage: {
      messageId: output.avatarMessage.messageId,
      conversationId: output.conversationId,
      role: 'avatar',
      content: output.avatarMessage.content,
      createdAt: output.avatarMessage.createdAt,
      metadata: {
        model: output.avatarMessage.model,
        latencyMs: output.avatarMessage.latencyMs,
        inputTokens: output.avatarMessage.inputTokens,
        outputTokens: output.avatarMessage.outputTokens,
        totalTokens: output.avatarMessage.inputTokens + output.avatarMessage.outputTokens,
      },
    },
    debug: {
      requestId: output.requestId,
      model: output.avatarMessage.model,
      latencyMs: output.avatarMessage.latencyMs,
      inputTokens: output.avatarMessage.inputTokens,
      outputTokens: output.avatarMessage.outputTokens,
    },
  }
}

function handleRouteError(error: unknown): { statusCode: number; body: ReturnType<typeof fail> } {
  if (error instanceof DomainError) {
    const code = error.code as string
    if (code === 'NOT_FOUND') return { statusCode: 404, body: fail('NOT_FOUND', error.message) }
    if (code === 'CONFLICT') return { statusCode: 409, body: fail('CONFLICT', error.message) }
    if (code === 'INVALID_INPUT' || code === 'VALIDATION_ERROR') {
      return { statusCode: 400, body: fail('VALIDATION_ERROR', error.message) }
    }
  }
  if (error instanceof LlmError) {
    return { statusCode: 502, body: fail('EXTERNAL_SERVICE_ERROR', error.message) }
  }
  return { statusCode: 500, body: fail('INTERNAL_ERROR', 'Internal server error') }
}
