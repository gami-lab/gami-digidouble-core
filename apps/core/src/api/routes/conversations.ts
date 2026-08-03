/* eslint-disable max-lines */
import type { FastifyPluginCallback } from 'fastify'
import { fail, MODEL_SELECTION_PROVIDER_NAMES, ok } from '@gami/shared'
import type {
  Message as SharedMessage,
  MessageStreamEvent,
  SendMessageRequest,
  SendMessageResponse,
} from '@gami/shared'
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
import type { IKnowledgeChunkRepository } from '../../application/ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeSourceRepository } from '../../application/ports/IKnowledgeSourceRepository.js'
import type { IModelConfigRepository } from '../../application/ports/IModelConfigRepository.js'
import type { IGmStateRepository } from '../../application/ports/IGmStateRepository.js'
import { GetHistoryUseCase } from '../../application/use-cases/get-history/get-history.use-case.js'
import type { RunGameMasterUseCase } from '../../application/use-cases/run-game-master/run-game-master.use-case.js'
import type { GetHistoryOutput } from '../../application/use-cases/get-history/get-history.types.js'
import { EndConversationUseCase } from '../../application/use-cases/end-conversation/end-conversation.use-case.js'
import { MemoryMaintenanceService } from '../../application/services/memory-maintenance.service.js'
import { TypedRetrievalService } from '../../application/services/knowledge/typed-retrieval.service.js'
import { SendMessageUseCase } from '../../application/use-cases/send-message/send-message.use-case.js'
import { StreamingSendMessageUseCase } from '../../application/use-cases/send-message/streaming-send-message.use-case.js'
import type { StreamingSendMessageEvent } from '../../application/use-cases/send-message/streaming-send-message.types.js'
import type { SendMessageOutput } from '../../application/use-cases/send-message/send-message.types.js'
import type { Message as DomainMessage } from '../../domain/conversation/session.types.js'
import type { Config } from '../../config.js'
import type { ModelConfig } from '../../domain/model-config/index.js'
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
import { InMemoryKnowledgeChunkRepository } from '../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { EpisodicMemoryService } from '../../application/services/episodic-memory.service.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { InMemoryUserRepository } from '../../infrastructure/db/in-memory-user.repository.js'
import { InMemoryGmStateRepository } from '../../infrastructure/db/in-memory-gm-state.repository.js'
import { createLlmAdapter, LlmError } from '../../infrastructure/llm/index.js'
import type { LlmConfig } from '../../infrastructure/llm/index.js'
import type { LlmAdapterRegistry } from '../../infrastructure/llm/llm-adapter-registry.js'
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
  knowledgeSourceRepository?: IKnowledgeSourceRepository
  knowledgeChunkRepository?: IKnowledgeChunkRepository
  modelConfigRepository?: IModelConfigRepository
  llmAdapterRegistry?: LlmAdapterRegistry
  modelConfigFallback?: ModelConfig
  gmStateRepository?: IGmStateRepository
}

type ConversationParams = { conversationId: string }

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
    model: {
      type: 'object',
      required: ['provider', 'model'],
      properties: {
        provider: { type: 'string', enum: MODEL_SELECTION_PROVIDER_NAMES },
        model: { type: 'string', minLength: 1, maxLength: 200 },
        serviceTier: { type: 'string', enum: ['fast'] },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const

// eslint-disable-next-line max-lines-per-function
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

  app.post<{ Params: ConversationParams; Body: SendMessageRequest }>(
    '/:conversationId/messages',
    { schema: { params: conversationParamsSchema, body: sendMessageBodySchema } },
    async (request, reply) => {
      try {
        const output = await deps.sendMessageUseCase.execute({
          conversationId: request.params.conversationId,
          userMessage: request.body.message.content,
          ...(request.body.model !== undefined ? { model: request.body.model } : {}),
        })
        const response = mapSendMessageResponse(output)
        return await reply.send(ok<SendMessageResponse>(response))
      } catch (error) {
        const mappedError = handleRouteError(error)
        return await reply.status(mappedError.statusCode).send(mappedError.body)
      }
    },
  )

  app.post<{ Params: ConversationParams; Body: SendMessageRequest }>(
    '/:conversationId/messages/stream',
    {
      config: { rawBody: true },
      schema: { params: conversationParamsSchema, body: sendMessageBodySchema, response: {} },
    },
    // eslint-disable-next-line complexity
    async (request, reply) => {
      const abortController = new AbortController()
      const onClose = (): void => {
        abortController.abort()
      }
      request.raw.once('close', onClose)

      const stream = deps.streamingSendMessageUseCase.execute(
        {
          conversationId: request.params.conversationId,
          userMessage: request.body.message.content,
          ...(request.body.model !== undefined ? { model: request.body.model } : {}),
        },
        { signal: abortController.signal },
      )
      const iterator = stream[Symbol.asyncIterator]()

      let responseStarted = false
      let streamRequestId: string | undefined
      try {
        const first = await iterator.next()
        if (first.done) throw new Error('Streaming message flow ended before it started.')
        streamRequestId = first.value.requestId

        if (!isStreamWritable(reply)) return

        reply.raw.setHeader('Content-Type', 'text/event-stream')
        reply.raw.setHeader('Cache-Control', 'no-cache')
        reply.raw.setHeader('Connection', 'keep-alive')
        reply.raw.setHeader('X-Accel-Buffering', 'no')
        reply.raw.setHeader('Access-Control-Allow-Origin', options.config.corsOrigin)
        await reply.hijack()
        responseStarted = true
        writeMessageStreamFrame(reply.raw, mapStreamingEvent(first.value))

        let next = await iterator.next()
        while (!next.done) {
          if (!isStreamWritable(reply)) break
          writeMessageStreamFrame(reply.raw, mapStreamingEvent(next.value))
          next = await iterator.next()
        }

        if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end()
      } catch (error) {
        if (!responseStarted) {
          const mappedError = handleRouteError(error)
          return await reply.status(mappedError.statusCode).send(mappedError.body)
        }

        if (isStreamWritable(reply)) {
          writeMessageStreamFrame(reply.raw, {
            type: 'conversation.message.error',
            requestId: streamRequestId ?? request.params.conversationId,
            conversationId: request.params.conversationId,
            message: 'Internal server error',
          })
          reply.raw.end()
        }
      } finally {
        request.raw.off('close', onClose)
        abortController.abort()
        await iterator.return?.()
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
  streamingSendMessageUseCase: StreamingSendMessageUseCase
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
  knowledgeSourceRepository: IKnowledgeSourceRepository
  knowledgeChunkRepository: IKnowledgeChunkRepository
  gmStateRepository: IGmStateRepository
}

function createRouteDependencies(options: ConversationsRouteOptions): RouteDependencies {
  const observabilityAdapter =
    options.observabilityAdapter ??
    createObservabilityAdapter({
      langfusePublicKey: options.config.langfusePublicKey,
      langfuseSecretKey: options.config.langfuseSecretKey,
      langfuseHost: options.config.langfuseHost,
    })
  const llmAdapter =
    options.llmAdapter ?? createLlmAdapter(buildLlmConfig(options.config), observabilityAdapter)
  const repositories = resolvePersistenceDeps(options)
  const memoryMaintenance = new MemoryMaintenanceService(
    repositories.messageRepository,
    repositories.conversationWorkingMemoryRepository,
    repositories.eventLogRepository,
    llmAdapter,
    options.modelConfigRepository,
    options.llmAdapterRegistry,
    options.modelConfigFallback,
    repositories.scenarioRepository,
    repositories.sessionRepository,
  )
  const episodicMemoryService = new EpisodicMemoryService(
    repositories.conversationMemoryRepository,
    repositories.conversationWorkingMemoryRepository,
    repositories.messageRepository,
  )
  const typedRetrievalService = new TypedRetrievalService(
    repositories.knowledgeSourceRepository,
    repositories.knowledgeChunkRepository,
  )

  const sendMessageUseCase = new SendMessageUseCase(
    repositories.sessionRepository,
    repositories.conversationRepository,
    repositories.avatarRepository,
    repositories.scenarioRepository,
    repositories.messageRepository,
    llmAdapter,
    repositories.eventLogRepository,
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
    undefined,
    typedRetrievalService,
    undefined,
    options.modelConfigRepository,
    options.llmAdapterRegistry,
    options.modelConfigFallback,
    repositories.gmStateRepository,
  )

  return {
    observabilityAdapter,
    conversationRepository: repositories.conversationRepository,
    messageRepository: repositories.messageRepository,
    sendMessageUseCase,
    streamingSendMessageUseCase: new StreamingSendMessageUseCase(sendMessageUseCase),
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
    ...resolveKnowledgeDeps(options),
    ...resolveWorkingMemoryDeps(options),
    gmStateRepository: options.gmStateRepository ?? new InMemoryGmStateRepository(),
  }
}

function resolveKnowledgeDeps(options: ConversationsRouteOptions): {
  knowledgeSourceRepository: IKnowledgeSourceRepository
  knowledgeChunkRepository: IKnowledgeChunkRepository
} {
  return {
    knowledgeSourceRepository:
      options.knowledgeSourceRepository ?? new InMemoryKnowledgeSourceRepository(),
    knowledgeChunkRepository:
      options.knowledgeChunkRepository ?? new InMemoryKnowledgeChunkRepository(),
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
    ...(config.xaiApiKey !== undefined ? { xaiApiKey: config.xaiApiKey } : {}),
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
      ...(output.session.avatarOptions !== undefined
        ? { avatarOptions: output.session.avatarOptions }
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

function mapStreamingEvent(event: StreamingSendMessageEvent): MessageStreamEvent {
  switch (event.type) {
    case 'started':
      return {
        type: 'conversation.message.started',
        requestId: event.requestId,
        conversationId: event.conversationId,
        userMessage: mapMessage(event.userMessage),
      }
    case 'delta':
      return {
        type: 'conversation.message.delta',
        requestId: event.requestId,
        conversationId: event.conversationId,
        sequence: event.sequence,
        delta: event.delta,
      }
    case 'completed':
      return {
        type: 'conversation.message.completed',
        requestId: event.requestId,
        conversationId: event.conversationId,
        response: mapSendMessageResponse(event.output),
      }
    case 'interrupted':
      return {
        type: 'conversation.message.interrupted',
        requestId: event.requestId,
        conversationId: event.conversationId,
        reason: event.reason,
      }
  }
}

function mapMessage(message: DomainMessage): SharedMessage {
  return message
}

function writeMessageStreamFrame(
  response: NodeJS.WritableStream & { write: (chunk: string) => boolean },
  event: MessageStreamEvent,
): void {
  const id = getMessageStreamEventId(event)
  response.write(`event: conversation_message\nid: ${id}\ndata: ${JSON.stringify(event)}\n\n`)
}

function getMessageStreamEventId(event: MessageStreamEvent): string {
  if (event.type === 'conversation.message.delta') {
    return `${event.requestId}:${String(event.sequence)}`
  }
  return `${event.requestId}:${event.type}`
}

function isStreamWritable(reply: { raw: { destroyed: boolean; writableEnded: boolean } }): boolean {
  return !reply.raw.destroyed && !reply.raw.writableEnded
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
