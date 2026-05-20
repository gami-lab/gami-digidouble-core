import { loadConfig } from './config.js'
import { createServer } from './api/server.js'
import type { IDependencyProbe } from './application/ports/IDependencyProbe.js'
import { RunGameMasterUseCase } from './application/use-cases/run-game-master/run-game-master.use-case.js'
import {
  DEFAULT_MODEL_CONFIG,
  isProviderName,
  type ModelConfig,
  type ProviderName,
} from './domain/model-config/index.js'
import { getRedisClient, closeRedisClient } from './infrastructure/cache/index.js'
import { LlmProbe, PostgresProbe, RedisProbe } from './infrastructure/health/index.js'
import { createObservabilityAdapter } from './infrastructure/observability/index.js'
import { createLlmAdapter, DefaultLlmAdapterRegistry } from './infrastructure/llm/index.js'
import { InMemorySessionEventPublisher } from './infrastructure/events/in-memory-session-event-publisher.js'
import { MemorySelectionService } from './application/services/memory-selection.service.js'
import {
  getDbClient,
  closeDbClient,
  PostgresScenarioRepository,
  PostgresAvatarRepository,
  PostgresEventLogRepository,
  PostgresGmStateRepository,
  PostgresSessionRepository,
  PostgresConversationRepository,
  PostgresMessageRepository,
  PostgresSessionMemoryRepository,
  PostgresAvatarSessionMemoryRepository,
  PostgresUserMemoryFactRepository,
  PostgresUserRepository,
  PostgresConversationWorkingMemoryRepository,
  PostgresConversationMemoryRepository,
  PostgresKnowledgeSourceRepository,
  PostgresKnowledgeChunkRepository,
  PostgresIngestionJobRepository,
  PostgresModelConfigRepository,
} from './infrastructure/db/index.js'
import { InMemoryKnowledgeSourceContentLoader } from './infrastructure/knowledge/in-memory-knowledge-source-content-loader.js'
import { HashEmbeddingAdapter } from './infrastructure/knowledge/hash-embedding.adapter.js'

type CoreRepositories = ReturnType<typeof buildCoreRepositories>

async function main(): Promise<void> {
  const config = loadConfig()
  const observability = createObservabilityAdapter(config)
  const llmConfig = buildLlmConfig(config)
  const llmAdapter = createLlmAdapter(llmConfig, observability)
  const llmAdapterRegistry = new DefaultLlmAdapterRegistry(
    buildLlmAdaptersByProvider(config, observability),
  )
  const sql = getDbClient(config.databaseUrl)
  const redisClient = getRedisClient(config.redisUrl)
  const repositories = buildCoreRepositories(sql)
  const knowledgeAdapters = buildKnowledgeAdapters(sql)
  const modelConfigRepository = repositories.modelConfigRepository
  const runtimeModelConfigFallback: ModelConfig = {
    ...DEFAULT_MODEL_CONFIG,
    globalDefault: { provider: resolveProviderName(config.llmProvider), model: '' },
  }
  const sessionEventPublisher = new InMemorySessionEventPublisher()
  const memorySelectionService = buildMemorySelectionService(repositories)
  const runGameMasterUseCase = new RunGameMasterUseCase(
    repositories.gmStateRepository,
    repositories.sessionRepository,
    repositories.avatarRepository,
    llmAdapter,
    observability,
    repositories.scenarioRepository,
    repositories.eventLogRepository,
    repositories.conversationRepository,
    repositories.messageRepository,
    sessionEventPublisher,
    memorySelectionService,
    undefined,
    modelConfigRepository,
    llmAdapterRegistry,
    runtimeModelConfigFallback,
  )
  const probes: IDependencyProbe[] = [
    new PostgresProbe(sql),
    new RedisProbe(redisClient),
    new LlmProbe(llmAdapter),
  ]

  const adapters = {
    llmAdapter,
    observabilityAdapter: observability,
    ...repositories,
    ...knowledgeAdapters,
    llmAdapterRegistry,
    modelConfigFallback: runtimeModelConfigFallback,
    runGameMasterUseCase,
    sessionEventPublisher,
    probes,
  }
  const server = createServer(config, adapters)

  server.addHook('onClose', async () => {
    await closeRedisClient()
    await closeDbClient()
    await observability.flush()
  })

  async function shutdown(): Promise<void> {
    await server.close()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())

  try {
    await server.listen({ port: config.port, host: config.host })
  } catch (err) {
    server.log.error(err)
    await server.close()
    process.exit(1)
  }
}

function buildLlmConfig(config: ReturnType<typeof loadConfig>) {
  return {
    provider: config.llmProvider,
    ...(config.openaiApiKey !== undefined ? { openaiApiKey: config.openaiApiKey } : {}),
    ...(config.anthropicApiKey !== undefined ? { anthropicApiKey: config.anthropicApiKey } : {}),
    ...(config.mistralApiKey !== undefined ? { mistralApiKey: config.mistralApiKey } : {}),
    ...(config.xaiApiKey !== undefined ? { xaiApiKey: config.xaiApiKey } : {}),
  }
}

function buildCoreRepositories(sql: ReturnType<typeof getDbClient>) {
  return {
    scenarioRepository: new PostgresScenarioRepository(sql),
    gmStateRepository: new PostgresGmStateRepository(sql),
    sessionRepository: new PostgresSessionRepository(sql),
    avatarRepository: new PostgresAvatarRepository(sql),
    eventLogRepository: new PostgresEventLogRepository(sql),
    conversationRepository: new PostgresConversationRepository(sql),
    messageRepository: new PostgresMessageRepository(sql),
    sessionMemoryRepository: new PostgresSessionMemoryRepository(sql),
    avatarSessionMemoryRepository: new PostgresAvatarSessionMemoryRepository(sql),
    userMemoryFactRepository: new PostgresUserMemoryFactRepository(sql),
    userRepository: new PostgresUserRepository(sql),
    conversationWorkingMemoryRepository: new PostgresConversationWorkingMemoryRepository(sql),
    conversationMemoryRepository: new PostgresConversationMemoryRepository(sql),
    modelConfigRepository: new PostgresModelConfigRepository(sql),
  }
}

function buildMemorySelectionService(repositories: CoreRepositories): MemorySelectionService {
  return new MemorySelectionService(
    repositories.messageRepository,
    repositories.conversationWorkingMemoryRepository,
    repositories.conversationMemoryRepository,
    repositories.userMemoryFactRepository,
  )
}

function buildLlmAdaptersByProvider(
  config: ReturnType<typeof loadConfig>,
  observability: ReturnType<typeof createObservabilityAdapter>,
): Partial<Record<ProviderName, ReturnType<typeof createLlmAdapter>>> {
  const llmConfig = buildLlmConfig(config)
  const adapters: Partial<Record<ProviderName, ReturnType<typeof createLlmAdapter>>> = {
    null: createLlmAdapter({ ...llmConfig, provider: 'null' }, observability),
  }

  if (config.openaiApiKey !== undefined && config.openaiApiKey.trim().length > 0) {
    adapters.openai = createLlmAdapter({ ...llmConfig, provider: 'openai' }, observability)
  }
  if (config.anthropicApiKey !== undefined && config.anthropicApiKey.trim().length > 0) {
    adapters.anthropic = createLlmAdapter({ ...llmConfig, provider: 'anthropic' }, observability)
  }
  if (config.mistralApiKey !== undefined && config.mistralApiKey.trim().length > 0) {
    adapters.mistral = createLlmAdapter({ ...llmConfig, provider: 'mistral' }, observability)
  }
  if (config.xaiApiKey !== undefined && config.xaiApiKey.trim().length > 0) {
    adapters.xai = createLlmAdapter({ ...llmConfig, provider: 'xai' }, observability)
  }
  return adapters
}

function resolveProviderName(value: string): ProviderName {
  return isProviderName(value) ? value : 'null'
}

function buildKnowledgeAdapters(sql: ReturnType<typeof getDbClient>) {
  return {
    knowledgeSourceRepository: new PostgresKnowledgeSourceRepository(sql),
    knowledgeChunkRepository: new PostgresKnowledgeChunkRepository(sql),
    ingestionJobRepository: new PostgresIngestionJobRepository(sql),
    knowledgeSourceContentLoader: new InMemoryKnowledgeSourceContentLoader(),
    embeddingAdapter: new HashEmbeddingAdapter(),
  }
}

await main()
