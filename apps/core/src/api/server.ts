import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { fail } from '@gami/shared'
import type { ILlmAdapter } from '../application/ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../application/ports/IObservabilityAdapter.js'
import type { IAvatarRepository } from '../application/ports/IAvatarRepository.js'
import type { IConversationRepository } from '../application/ports/IConversationRepository.js'
import type { IEventLogRepository } from '../application/ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../application/ports/IGmStateRepository.js'
import type { IScenarioRepository } from '../application/ports/IScenarioRepository.js'
import type { ISessionRepository } from '../application/ports/ISessionRepository.js'
import type { IMessageRepository } from '../application/ports/IMessageRepository.js'
import type { ISessionMemoryRepository } from '../application/ports/ISessionMemoryRepository.js'
import type { IUserMemoryFactRepository } from '../application/ports/IUserMemoryFactRepository.js'
import type { IUserRepository } from '../application/ports/IUserRepository.js'
import type { IAvatarSessionMemoryRepository } from '../application/ports/IAvatarSessionMemoryRepository.js'
import type { IDependencyProbe } from '../application/ports/IDependencyProbe.js'
import type { ISessionEventPublisher } from '../application/ports/ISessionEventPublisher.js'
import type { IConversationWorkingMemoryRepository } from '../application/ports/IConversationWorkingMemoryRepository.js'
import type { IConversationMemoryRepository } from '../application/ports/IConversationMemoryRepository.js'
import type { IKnowledgeSourceRepository } from '../application/ports/IKnowledgeSourceRepository.js'
import type { IKnowledgeChunkRepository } from '../application/ports/IKnowledgeChunkRepository.js'
import type { IIngestionJobRepository } from '../application/ports/IIngestionJobRepository.js'
import type { IKnowledgeSourceContentLoader } from '../application/ports/IKnowledgeSourceContentLoader.js'
import type { IEmbeddingAdapter } from '../application/ports/IEmbeddingAdapter.js'
import type { IModelConfigRepository } from '../application/ports/IModelConfigRepository.js'
import type { ModelConfig } from '../domain/model-config/index.js'
import type { RunGameMasterUseCase } from '../application/use-cases/run-game-master/run-game-master.use-case.js'
import type { Config } from '../config.js'
import { InMemoryEventLogRepository } from '../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryGmStateRepository } from '../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemorySessionRepository } from '../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserMemoryFactRepository } from '../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { InMemoryUserRepository } from '../infrastructure/db/in-memory-user.repository.js'
import { InMemorySessionMemoryRepository } from '../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemoryAvatarSessionMemoryRepository } from '../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryConversationRepository } from '../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryAvatarRepository } from '../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../infrastructure/db/in-memory-scenario.repository.js'
import { InMemoryMessageRepository } from '../infrastructure/db/in-memory-message.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemorySessionEventPublisher } from '../infrastructure/events/in-memory-session-event-publisher.js'
import { createLlmAdapter } from '../infrastructure/llm/index.js'
import type { LlmConfig } from '../infrastructure/llm/index.js'
import type { LlmAdapterRegistry } from '../infrastructure/llm/llm-adapter-registry.js'
import { adminMemoryRoute } from './routes/admin-memory.js'
import { adminSessionsRoute } from './routes/admin-sessions.js'
import { adminMetricsRoute } from './routes/admin-metrics.js'
import { adminHealthRoute } from './routes/admin-health.js'
import { adminSessionContextRoute } from './routes/admin-session-context.js'
import { adminRuntimeActionsRoute } from './routes/admin-runtime-actions.js'
import { avatarsRoute, type AvatarsRouteOptions } from './routes/avatars.js'
import { conversationsRoute } from './routes/conversations.js'
import { exchangeRoute } from './routes/exchange.js'
import { healthRoute } from './routes/health.js'
import { sessionsRoute } from './routes/sessions.js'
import { scenariosRoute, type ScenariosRouteOptions } from './routes/scenarios.js'
import { usersRoute } from './routes/users.js'
import { knowledgeRoute } from './routes/knowledge.js'
import { InMemoryKnowledgeSourceRepository } from '../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryKnowledgeChunkRepository } from '../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryIngestionJobRepository } from '../infrastructure/db/in-memory-ingestion-job.repository.js'
import { InMemoryModelConfigRepository } from '../infrastructure/db/in-memory-model-config.repository.js'
import { InMemoryKnowledgeSourceContentLoader } from '../infrastructure/knowledge/in-memory-knowledge-source-content-loader.js'
import { HashEmbeddingAdapter } from '../infrastructure/knowledge/hash-embedding.adapter.js'
import { adminModelConfigRoute } from './routes/admin-model-config.js'

export interface ServerAdapters {
  llmAdapter?: ILlmAdapter
  observabilityAdapter?: IObservabilityAdapter
  avatarRepository?: IAvatarRepository
  conversationRepository?: IConversationRepository
  eventLogRepository?: IEventLogRepository
  gmStateRepository?: IGmStateRepository
  runGameMasterUseCase?: RunGameMasterUseCase
  scenarioRepository?: IScenarioRepository
  sessionRepository?: ISessionRepository
  messageRepository?: IMessageRepository
  sessionMemoryRepository?: ISessionMemoryRepository
  avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
  conversationMemoryRepository?: IConversationMemoryRepository
  userRepository?: IUserRepository
  userMemoryFactRepository?: IUserMemoryFactRepository
  sessionEventPublisher?: ISessionEventPublisher
  probes?: IDependencyProbe[]
  knowledgeSourceRepository?: IKnowledgeSourceRepository
  knowledgeChunkRepository?: IKnowledgeChunkRepository
  ingestionJobRepository?: IIngestionJobRepository
  knowledgeSourceContentLoader?: IKnowledgeSourceContentLoader
  embeddingAdapter?: IEmbeddingAdapter
  modelConfigRepository?: IModelConfigRepository
  llmAdapterRegistry?: LlmAdapterRegistry
  modelConfigFallback?: ModelConfig
}

type FastifyValidationError = {
  statusCode?: number
  validation?: unknown
}

function isFastifyValidationError(
  error: unknown,
): error is FastifyValidationError & { validation: unknown } {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as FastifyValidationError
  return candidate.statusCode === 400 && candidate.validation !== undefined
}

type FastifyBodyParsingError = {
  code?: string
  statusCode?: number
  message?: string
}

/**
 * Fastify throws these during the parsing phase — before preValidation and
 * before any route's own preHandler/try-catch — whenever a client sends
 * `Content-Type: application/json` with a body that is empty, malformed, or
 * size-mismatched (`FST_ERR_CTP_EMPTY_JSON_BODY`, `FST_ERR_CTP_INVALID_JSON_BODY`,
 * `FST_ERR_CTP_INVALID_CONTENT_LENGTH`, `FST_ERR_CTP_INVALID_MEDIA_TYPE`, ...).
 * They carry a 4xx `statusCode` but no `.validation` property, so
 * `isFastifyValidationError` doesn't recognize them and they used to fall
 * through to the generic 500 branch below.
 *
 * Because parsing runs ahead of any route's `preHandler` auth hook, these
 * errors surface before authentication is checked — an unauthenticated
 * malformed request gets 400 instead of 401. That's acceptable: no
 * privileged data or behavior is exposed, and it matches standard REST
 * practice of rejecting a structurally invalid request before doing
 * anything else with it.
 */
function isFastifyBodyParsingError(
  error: unknown,
): error is FastifyBodyParsingError & { code: string; statusCode: number } {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as FastifyBodyParsingError
  return (
    typeof candidate.code === 'string' &&
    candidate.code.startsWith('FST_ERR_CTP_') &&
    typeof candidate.statusCode === 'number' &&
    candidate.statusCode >= 400 &&
    candidate.statusCode < 500
  )
}

export function createServer(config: Config, adapters: ServerAdapters = {}): FastifyInstance {
  const resolvedAdapters = resolveServerAdapters(adapters)

  const app = Fastify({
    logger: config.nodeEnv !== 'test' ? { level: config.logLevel } : false,
  })

  void app.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  })

  app.setErrorHandler((error, request, reply) => {
    if (isFastifyValidationError(error)) {
      return reply
        .status(400)
        .send(fail('VALIDATION_ERROR', 'Invalid request body', error.validation))
    }

    if (isFastifyBodyParsingError(error)) {
      return reply
        .status(error.statusCode)
        .send(fail('VALIDATION_ERROR', error.message ?? 'Malformed request body'))
    }

    request.log.error(
      {
        err: error,
        method: request.method,
        url: request.url,
      },
      'Unhandled request error',
    )

    return reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
  })

  app.register(healthRoute)
  app.register(exchangeRoute, { config, ...resolvedAdapters })
  app.register(sessionsRoute, {
    prefix: '/v1/sessions',
    config,
    ...resolvedAdapters,
    sessionEventPublisher: resolvedAdapters.sessionEventPublisher,
  })
  app.register(conversationsRoute, {
    prefix: '/v1/conversations',
    config,
    ...resolvedAdapters,
  })
  app.register(adminSessionsRoute, {
    prefix: '/v1/admin',
    config,
    ...resolvedAdapters,
  })
  app.register(adminHealthRoute, {
    prefix: '/v1/admin',
    config,
    probes: adapters.probes ?? [],
  })
  app.register(adminMetricsRoute, {
    prefix: '/v1/admin',
    config,
    sessionRepository: resolvedAdapters.sessionRepository ?? new InMemorySessionRepository(),
    eventLogRepository: resolvedAdapters.eventLogRepository,
  })
  app.register(adminMemoryRoute, {
    ...buildAdminMemoryRouteOptions(config, resolvedAdapters),
  })
  app.register(adminSessionContextRoute, {
    ...buildAdminSessionContextRouteOptions(config, resolvedAdapters),
  })
  app.register(adminRuntimeActionsRoute, {
    ...buildAdminRuntimeActionsRouteOptions(config, resolvedAdapters),
  })
  app.register(adminModelConfigRoute, {
    prefix: '/v1/admin',
    config,
    modelConfigRepository: withDefault(
      resolvedAdapters.modelConfigRepository,
      new InMemoryModelConfigRepository(),
    ),
    ...(resolvedAdapters.modelConfigFallback !== undefined
      ? { modelConfigFallback: resolvedAdapters.modelConfigFallback }
      : {}),
  })
  app.register(scenariosRoute, {
    prefix: '/v1/scenarios',
    ...buildScenariosRouteOptions(config, resolvedAdapters),
  })
  app.register(usersRoute, {
    prefix: '/v1/users',
    config,
    userRepository: resolvedAdapters.userRepository,
    userMemoryFactRepository:
      resolvedAdapters.userMemoryFactRepository ?? new InMemoryUserMemoryFactRepository(),
  })
  app.register(avatarsRoute, {
    prefix: '/v1/avatars',
    ...buildAvatarsRouteOptions(config, resolvedAdapters),
  })
  registerKnowledgeRoute(app, config, resolvedAdapters)

  return app
}

function registerKnowledgeRoute(
  app: FastifyInstance,
  config: Config,
  adapters: ServerAdapters,
): void {
  app.register(knowledgeRoute, {
    config,
    sourceRepository: adapters.knowledgeSourceRepository ?? new InMemoryKnowledgeSourceRepository(),
    chunkRepository: adapters.knowledgeChunkRepository ?? new InMemoryKnowledgeChunkRepository(),
    ingestionJobRepository: adapters.ingestionJobRepository ?? new InMemoryIngestionJobRepository(),
    sourceContentLoader:
      adapters.knowledgeSourceContentLoader ?? new InMemoryKnowledgeSourceContentLoader(),
    embeddingAdapter: adapters.embeddingAdapter ?? new HashEmbeddingAdapter(),
    eventLogRepository: withDefault(adapters.eventLogRepository, new InMemoryEventLogRepository()),
  })
}

function resolveServerAdapters(
  adapters: ServerAdapters,
): Required<
  Pick<
    ServerAdapters,
    'eventLogRepository' | 'gmStateRepository' | 'userRepository' | 'sessionEventPublisher'
  >
> &
  ServerAdapters {
  const sessionEventPublisher =
    adapters.sessionEventPublisher ?? new InMemorySessionEventPublisher()

  return {
    ...adapters,
    eventLogRepository: adapters.eventLogRepository ?? new InMemoryEventLogRepository(),
    gmStateRepository: adapters.gmStateRepository ?? new InMemoryGmStateRepository(),
    userRepository: adapters.userRepository ?? new InMemoryUserRepository(),
    sessionEventPublisher,
  }
}

function buildScenariosRouteOptions(
  config: Config,
  adapters: ServerAdapters,
): ScenariosRouteOptions {
  return {
    config,
    ...(adapters.scenarioRepository !== undefined
      ? { scenarioRepository: adapters.scenarioRepository }
      : {}),
    ...(adapters.avatarRepository !== undefined
      ? { avatarRepository: adapters.avatarRepository }
      : {}),
    ...(adapters.sessionRepository !== undefined
      ? { sessionRepository: adapters.sessionRepository }
      : {}),
    knowledgeSourceRepository: withDefault(
      adapters.knowledgeSourceRepository,
      new InMemoryKnowledgeSourceRepository(),
    ),
    llmAdapter:
      adapters.llmAdapter ??
      createLlmAdapter(resolveServerLlmConfig(config), adapters.observabilityAdapter),
    ...(adapters.observabilityAdapter !== undefined
      ? { observabilityAdapter: adapters.observabilityAdapter }
      : {}),
    ...(adapters.modelConfigRepository !== undefined
      ? { modelConfigRepository: adapters.modelConfigRepository }
      : {}),
    ...(adapters.llmAdapterRegistry !== undefined
      ? { llmAdapterRegistry: adapters.llmAdapterRegistry }
      : {}),
    ...(adapters.modelConfigFallback !== undefined
      ? { modelConfigFallback: adapters.modelConfigFallback }
      : {}),
  }
}

function buildAvatarsRouteOptions(config: Config, adapters: ServerAdapters): AvatarsRouteOptions {
  return {
    config,
    ...(adapters.avatarRepository !== undefined
      ? { avatarRepository: adapters.avatarRepository }
      : {}),
    ...(adapters.sessionRepository !== undefined
      ? { sessionRepository: adapters.sessionRepository }
      : {}),
  }
}

function buildAdminMemoryRouteOptions(config: Config, adapters: ServerAdapters) {
  return {
    prefix: '/v1/admin',
    config,
    sessionRepository: adapters.sessionRepository ?? new InMemorySessionRepository(),
    sessionMemoryRepository:
      adapters.sessionMemoryRepository ?? new InMemorySessionMemoryRepository(),
    avatarSessionMemoryRepository:
      adapters.avatarSessionMemoryRepository ?? new InMemoryAvatarSessionMemoryRepository(),
    ...(adapters.conversationRepository !== undefined
      ? { conversationRepository: adapters.conversationRepository }
      : {}),
    ...(adapters.messageRepository !== undefined
      ? { messageRepository: adapters.messageRepository }
      : {}),
    ...(adapters.conversationWorkingMemoryRepository !== undefined
      ? { conversationWorkingMemoryRepository: adapters.conversationWorkingMemoryRepository }
      : {}),
    ...(adapters.conversationMemoryRepository !== undefined
      ? { conversationMemoryRepository: adapters.conversationMemoryRepository }
      : {}),
    eventLogRepository: withDefault(adapters.eventLogRepository, new InMemoryEventLogRepository()),
    userMemoryFactRepository:
      adapters.userMemoryFactRepository ?? new InMemoryUserMemoryFactRepository(),
  }
}

function buildAdminSessionContextRouteOptions(config: Config, adapters: ServerAdapters) {
  return {
    prefix: '/v1/admin',
    config,
    sessionRepository: withDefault(adapters.sessionRepository, new InMemorySessionRepository()),
    conversationRepository: withDefault(
      adapters.conversationRepository,
      new InMemoryConversationRepository(),
    ),
    avatarRepository: withDefault(adapters.avatarRepository, new InMemoryAvatarRepository()),
    scenarioRepository: withDefault(adapters.scenarioRepository, new InMemoryScenarioRepository()),
    messageRepository: withDefault(adapters.messageRepository, new InMemoryMessageRepository()),
    conversationWorkingMemoryRepository: withDefault(
      adapters.conversationWorkingMemoryRepository,
      new InMemoryConversationWorkingMemoryRepository(),
    ),
    userRepository: withDefault(adapters.userRepository, new InMemoryUserRepository()),
    gmStateRepository: withDefault(adapters.gmStateRepository, new InMemoryGmStateRepository()),
    userMemoryFactRepository: withDefault(
      adapters.userMemoryFactRepository,
      new InMemoryUserMemoryFactRepository(),
    ),
  }
}

function buildAdminRuntimeActionsRouteOptions(config: Config, adapters: ServerAdapters) {
  return {
    prefix: '/v1/admin',
    config,
    llmAdapter:
      adapters.llmAdapter ??
      createLlmAdapter(resolveServerLlmConfig(config), adapters.observabilityAdapter),
    sessionRepository: withDefault(adapters.sessionRepository, new InMemorySessionRepository()),
    conversationRepository: withDefault(
      adapters.conversationRepository,
      new InMemoryConversationRepository(),
    ),
    messageRepository: withDefault(adapters.messageRepository, new InMemoryMessageRepository()),
    eventLogRepository: withDefault(adapters.eventLogRepository, new InMemoryEventLogRepository()),
    ...(adapters.runGameMasterUseCase !== undefined
      ? { runGameMasterUseCase: adapters.runGameMasterUseCase }
      : {}),
    userRepository: withDefault(adapters.userRepository, new InMemoryUserRepository()),
    sessionMemoryRepository: withDefault(
      adapters.sessionMemoryRepository,
      new InMemorySessionMemoryRepository(),
    ),
    avatarSessionMemoryRepository: withDefault(
      adapters.avatarSessionMemoryRepository,
      new InMemoryAvatarSessionMemoryRepository(),
    ),
    conversationWorkingMemoryRepository: withDefault(
      adapters.conversationWorkingMemoryRepository,
      new InMemoryConversationWorkingMemoryRepository(),
    ),
    ...(adapters.modelConfigRepository !== undefined
      ? { modelConfigRepository: adapters.modelConfigRepository }
      : {}),
    ...(adapters.llmAdapterRegistry !== undefined
      ? { llmAdapterRegistry: adapters.llmAdapterRegistry }
      : {}),
    ...(adapters.modelConfigFallback !== undefined
      ? { modelConfigFallback: adapters.modelConfigFallback }
      : {}),
  }
}

function withDefault<T>(value: T | undefined, fallback: T): T {
  return value ?? fallback
}

function resolveServerLlmConfig(config: Config): LlmConfig {
  return {
    provider: config.llmProvider,
    ...(config.openaiApiKey !== undefined ? { openaiApiKey: config.openaiApiKey } : {}),
    ...(config.anthropicApiKey !== undefined ? { anthropicApiKey: config.anthropicApiKey } : {}),
    ...(config.mistralApiKey !== undefined ? { mistralApiKey: config.mistralApiKey } : {}),
    ...(config.xaiApiKey !== undefined ? { xaiApiKey: config.xaiApiKey } : {}),
  }
}
