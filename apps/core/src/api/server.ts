import Fastify, { type FastifyInstance } from 'fastify'
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
import type { IUserRepository } from '../application/ports/IUserRepository.js'
import type { IDependencyProbe } from '../application/ports/IDependencyProbe.js'
import type { ISessionEventPublisher } from '../application/ports/ISessionEventPublisher.js'
import type { IConversationWorkingMemoryRepository } from '../application/ports/IConversationWorkingMemoryRepository.js'
import type { IConversationMemoryRepository } from '../application/ports/IConversationMemoryRepository.js'
import type { IKnowledgeSourceRepository } from '../application/ports/IKnowledgeSourceRepository.js'
import type { IKnowledgeChunkRepository } from '../application/ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeCorpusRepository } from '../application/ports/IKnowledgeCorpusRepository.js'
import type { IIngestionJobRepository } from '../application/ports/IIngestionJobRepository.js'
import type { IKnowledgeSourceContentLoader } from '../application/ports/IKnowledgeSourceContentLoader.js'
import type { IEmbeddingAdapter } from '../application/ports/IEmbeddingAdapter.js'
import type { ISpeechToTextAdapter } from '../application/ports/ISpeechToTextAdapter.js'
import type { IUtteranceIdempotencyStore } from '../application/ports/IUtteranceIdempotencyStore.js'
import type { IModelConfigRepository } from '../application/ports/IModelConfigRepository.js'
import type { ModelConfig } from '../domain/model-config/index.js'
import type { TypedRetrievalService } from '../application/services/knowledge/typed-retrieval.service.js'
import type { RunGameMasterUseCase } from '../application/use-cases/run-game-master/run-game-master.use-case.js'
import type { Config } from '../config.js'
import { InMemoryEventLogRepository } from '../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryGmStateRepository } from '../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemorySessionRepository } from '../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserRepository } from '../infrastructure/db/in-memory-user.repository.js'
import { InMemoryConversationRepository } from '../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryAvatarRepository } from '../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../infrastructure/db/in-memory-scenario.repository.js'
import { InMemoryMessageRepository } from '../infrastructure/db/in-memory-message.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemorySessionEventPublisher } from '../infrastructure/events/in-memory-session-event-publisher.js'
import { buildLlmConfig, createLlmAdapter } from '../infrastructure/llm/index.js'
import type { LlmAdapterRegistry } from '../infrastructure/llm/llm-adapter-registry.js'
import { registerAuthentication } from './hooks/authenticate.js'
import { playerVerifier, registerPlayerOwnership } from './hooks/player-credentials.js'
import { adminPlayerTokenRoute, playerAuthRoute } from './routes/player-auth.js'
import { PlayerTokenService } from '../application/auth/player-token.service.js'
import { PlayerAccessService } from '../application/auth/player-access.service.js'
import { adminVerifier } from './hooks/admin-credentials.js'
import { adminAuthRoute } from './routes/admin-auth.js'
import { AdminAuthService } from '../application/auth/admin-auth.service.js'
import { InMemoryAdminSessionStore } from '../application/auth/in-memory-admin-session.store.js'
import { verifyPassword } from '../application/auth/password-hash.js'
import type { IAdminSessionStore } from '../application/ports/IAdminSessionStore.js'
import { DEFAULT_BODY_LIMITS, enforceRouteTiers, registerTierScope } from './route-tiers.js'
import { registerTierCors } from './cors.js'
import { registerRateLimits } from './rate-limit.js'
import { InMemoryRateLimiter } from '../application/rate-limit/in-memory-rate-limiter.js'
import type { IRateLimiter } from '../application/ports/IRateLimiter.js'
import { adminSessionManagementRoute } from './routes/admin-session-management.js'
import { scenarioCatalogueRoute } from './routes/scenario-catalogue.js'
import { adminMemoryRoute } from './routes/admin-memory.js'
import { adminSessionsRoute } from './routes/admin-sessions.js'
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
import { InMemoryKnowledgeCorpusRepository } from '../infrastructure/db/in-memory-knowledge-corpus.repository.js'
import { InMemoryIngestionJobRepository } from '../infrastructure/db/in-memory-ingestion-job.repository.js'
import { InMemoryModelConfigRepository } from '../infrastructure/db/in-memory-model-config.repository.js'
import { InMemoryKnowledgeSourceContentLoader } from '../infrastructure/knowledge/in-memory-knowledge-source-content-loader.js'
import { UnconfiguredEmbeddingAdapter } from '../infrastructure/knowledge/unconfigured-embedding.adapter.js'
import { InMemoryUtteranceIdempotencyStore } from '../application/voice/in-memory-utterance-idempotency.store.js'
import { adminModelConfigRoute } from './routes/admin-model-config.js'
import { adminVoicesRoute } from './routes/admin-voices.js'
import { TextToSpeechProviders } from '../application/voice/text-to-speech-providers.js'
import { adminKnowledgeReindexRoute } from './routes/admin-knowledge-reindex.js'

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
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
  conversationMemoryRepository?: IConversationMemoryRepository
  userRepository?: IUserRepository
  sessionEventPublisher?: ISessionEventPublisher
  probes?: IDependencyProbe[]
  knowledgeSourceRepository?: IKnowledgeSourceRepository
  knowledgeChunkRepository?: IKnowledgeChunkRepository
  knowledgeCorpusRepository?: IKnowledgeCorpusRepository
  ingestionJobRepository?: IIngestionJobRepository
  knowledgeSourceContentLoader?: IKnowledgeSourceContentLoader
  embeddingAdapter?: IEmbeddingAdapter
  speechToTextAdapter?: ISpeechToTextAdapter
  textToSpeechProviders?: TextToSpeechProviders
  utteranceIdempotencyStore?: IUtteranceIdempotencyStore
  modelConfigRepository?: IModelConfigRepository
  llmAdapterRegistry?: LlmAdapterRegistry
  modelConfigFallback?: ModelConfig
  typedRetrievalService?: TypedRetrievalService
  adminSessionStore?: IAdminSessionStore
  rateLimiter?: IRateLimiter
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
 * Fastify throws these during the parsing phase whenever a client sends
 * `Content-Type: application/json` with a body that is empty, malformed, or
 * size-mismatched (`FST_ERR_CTP_EMPTY_JSON_BODY`, `FST_ERR_CTP_INVALID_JSON_BODY`,
 * `FST_ERR_CTP_INVALID_CONTENT_LENGTH`, `FST_ERR_CTP_INVALID_MEDIA_TYPE`, ...).
 * They carry a 4xx `statusCode` but no `.validation` property, so
 * `isFastifyValidationError` doesn't recognize them.
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
    trustProxy: (_address: string, hop: number) => hop < config.trustProxyHops,
    bodyLimit: DEFAULT_BODY_LIMITS.open,
    // Fastify strips unknown properties by default; the contract rejects them instead.
    ajv: { customOptions: { removeAdditional: false } },
  })

  registerTierCors(app, {
    playerOrigins: config.playerOrigins,
    adminOrigins: config.adminOrigins,
  })

  app.setErrorHandler((error, request, reply) => {
    if (isFastifyValidationError(error)) {
      return reply
        .status(400)
        .send(fail('VALIDATION_ERROR', 'Invalid request body', error.validation))
    }

    if (isFastifyBodyParsingError(error)) {
      return reply
        .status(400)
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

  enforceRouteTiers(app)
  const adminAuthService = createAdminAuthService(config, adapters.adminSessionStore)
  const playerTokens = new PlayerTokenService({
    secret: config.playerTokenSecret,
    ttlSeconds: config.playerTokenTtlSeconds,
    refreshWindowSeconds: config.playerTokenRefreshWindowSeconds,
  })
  registerAuthentication(app, {
    public: playerVerifier(playerTokens),
    admin: adminVerifier({
      authService: adminAuthService,
      serviceKey: config.adminServiceKey,
      allowedOrigins: config.adminOrigins,
      playerTokens,
    }),
  })
  registerRateLimits(app, adapters.rateLimiter ?? new InMemoryRateLimiter(), config.rateLimits)

  app.register(healthRoute)
  registerTierScope(app, 'public', '/v1', (scope) => {
    registerPlayerOwnership(
      scope,
      new PlayerAccessService(
        resolvedAdapters.sessionRepository,
        resolvedAdapters.conversationRepository,
      ),
    )
    scope.register(playerAuthRoute, { playerTokens })
    registerPublicRoutes(scope, config, resolvedAdapters)
  })
  registerTierScope(app, 'admin', '/v1/admin', (scope) => {
    scope.register(adminAuthRoute, { authService: adminAuthService })
    scope.register(adminPlayerTokenRoute, { playerTokens })
    registerAdminRoutes(scope, config, resolvedAdapters, adapters.probes ?? [])
  })

  return app
}

function createAdminAuthService(
  config: Config,
  store: IAdminSessionStore = new InMemoryAdminSessionStore(),
): AdminAuthService {
  const passwordHash = config.adminPasswordHash
  return new AdminAuthService({
    store,
    verifyCredential: async (password) =>
      passwordHash !== undefined && (await verifyPassword(password, passwordHash)),
    sessionSecret: config.adminSessionSecret,
    sessionTtlSeconds: config.adminSessionTtlSeconds,
  })
}

function registerPublicRoutes(
  scope: FastifyInstance,
  config: Config,
  adapters: ReturnType<typeof resolveServerAdapters>,
): void {
  scope.register(sessionsRoute, { prefix: '/sessions', config, ...adapters })
  scope.register(conversationsRoute, { prefix: '/conversations', config, ...adapters })
  scope.register(usersRoute, {
    prefix: '/me',
    config,
    userRepository: adapters.userRepository,
  })
  scope.register(scenarioCatalogueRoute, {
    prefix: '/scenarios',
    ...(adapters.scenarioRepository !== undefined
      ? { scenarioRepository: adapters.scenarioRepository }
      : {}),
  })
}

function registerAdminRoutes(
  scope: FastifyInstance,
  config: Config,
  adapters: ReturnType<typeof resolveServerAdapters>,
  probes: IDependencyProbe[],
): void {
  scope.register(exchangeRoute, { config, ...adapters })
  scope.register(adminSessionsRoute, { config, ...adapters })
  scope.register(adminSessionManagementRoute, { sessionRepository: adapters.sessionRepository })
  scope.register(adminHealthRoute, { config, probes })
  scope.register(adminMemoryRoute, buildAdminMemoryRouteOptions(config, adapters))
  scope.register(adminSessionContextRoute, buildAdminSessionContextRouteOptions(config, adapters))
  scope.register(adminRuntimeActionsRoute, buildAdminRuntimeActionsRouteOptions(config, adapters))
  scope.register(adminModelConfigRoute, {
    config,
    modelConfigRepository: withDefault(
      adapters.modelConfigRepository,
      new InMemoryModelConfigRepository(),
    ),
    ...(adapters.modelConfigFallback !== undefined
      ? { modelConfigFallback: adapters.modelConfigFallback }
      : {}),
  })
  scope.register(adminVoicesRoute, {
    config,
    textToSpeechProviders: withDefault(adapters.textToSpeechProviders, new TextToSpeechProviders()),
  })
  scope.register(scenariosRoute, {
    prefix: '/scenarios',
    ...buildScenariosRouteOptions(config, adapters),
  })
  scope.register(avatarsRoute, {
    prefix: '/avatars',
    ...buildAvatarsRouteOptions(config, adapters),
  })
  registerKnowledgeRoute(scope, config, adapters)
}

function registerKnowledgeRoute(
  app: FastifyInstance,
  config: Config,
  adapters: ServerAdapters,
): void {
  const chunkRepository =
    adapters.knowledgeChunkRepository ?? new InMemoryKnowledgeChunkRepository()
  const corpusRepository =
    adapters.knowledgeCorpusRepository ??
    new InMemoryKnowledgeCorpusRepository(
      chunkRepository instanceof InMemoryKnowledgeChunkRepository
        ? chunkRepository
        : new InMemoryKnowledgeChunkRepository(),
    )
  const sourceRepository =
    adapters.knowledgeSourceRepository ?? new InMemoryKnowledgeSourceRepository()
  const sourceContentLoader =
    adapters.knowledgeSourceContentLoader ?? new InMemoryKnowledgeSourceContentLoader()
  const embeddingAdapter = adapters.embeddingAdapter ?? new UnconfiguredEmbeddingAdapter()
  const eventLogRepository = withDefault(
    adapters.eventLogRepository,
    new InMemoryEventLogRepository(),
  )
  app.register(knowledgeRoute, {
    config,
    sourceRepository,
    chunkRepository,
    knowledgeCorpusRepository: corpusRepository,
    ingestionJobRepository: adapters.ingestionJobRepository ?? new InMemoryIngestionJobRepository(),
    sourceContentLoader,
    embeddingAdapter,
    eventLogRepository,
    ...(adapters.typedRetrievalService !== undefined
      ? { typedRetrievalService: adapters.typedRetrievalService }
      : {}),
  })
  app.register(adminKnowledgeReindexRoute, {
    config,
    sourceRepository,
    corpusRepository,
    sourceContentLoader,
    embeddingAdapter,
    eventLogRepository,
  })
}

function resolveServerAdapters(
  adapters: ServerAdapters,
): Required<
  Pick<
    ServerAdapters,
    | 'eventLogRepository'
    | 'gmStateRepository'
    | 'userRepository'
    | 'sessionEventPublisher'
    | 'sessionRepository'
    | 'conversationRepository'
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
    sessionRepository: adapters.sessionRepository ?? new InMemorySessionRepository(),
    conversationRepository: adapters.conversationRepository ?? new InMemoryConversationRepository(),
    ...(adapters.speechToTextAdapter !== undefined &&
    adapters.utteranceIdempotencyStore === undefined
      ? { utteranceIdempotencyStore: new InMemoryUtteranceIdempotencyStore() }
      : {}),
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
      createLlmAdapter(buildLlmConfig(config), adapters.observabilityAdapter),
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
    textToSpeechProviders: withDefault(adapters.textToSpeechProviders, new TextToSpeechProviders()),
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
    textToSpeechProviders: withDefault(adapters.textToSpeechProviders, new TextToSpeechProviders()),
  }
}

function buildAdminMemoryRouteOptions(config: Config, adapters: ServerAdapters) {
  return {
    config,
    sessionRepository: adapters.sessionRepository ?? new InMemorySessionRepository(),
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
  }
}

function buildAdminSessionContextRouteOptions(config: Config, adapters: ServerAdapters) {
  return {
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
  }
}

function buildAdminRuntimeActionsRouteOptions(config: Config, adapters: ServerAdapters) {
  return {
    config,
    llmAdapter:
      adapters.llmAdapter ??
      createLlmAdapter(buildLlmConfig(config), adapters.observabilityAdapter),
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
    ...(adapters.scenarioRepository !== undefined
      ? { scenarioRepository: adapters.scenarioRepository }
      : {}),
  }
}

function withDefault<T>(value: T | undefined, fallback: T): T {
  return value ?? fallback
}
