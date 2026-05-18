import { loadConfig } from './config.js'
import { createServer } from './api/server.js'
import type { IDependencyProbe } from './application/ports/IDependencyProbe.js'
import { RunGameMasterUseCase } from './application/use-cases/run-game-master/run-game-master.use-case.js'
import { getRedisClient, closeRedisClient } from './infrastructure/cache/index.js'
import { LlmProbe, PostgresProbe, RedisProbe } from './infrastructure/health/index.js'
import { createObservabilityAdapter } from './infrastructure/observability/index.js'
import { createLlmAdapter } from './infrastructure/llm/index.js'
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

async function main(): Promise<void> {
  const config = loadConfig()
  const observability = createObservabilityAdapter(config)
  const llmAdapter = createLlmAdapter(
    {
      provider: config.llmProvider,
      ...(config.openaiApiKey !== undefined ? { openaiApiKey: config.openaiApiKey } : {}),
      ...(config.anthropicApiKey !== undefined ? { anthropicApiKey: config.anthropicApiKey } : {}),
      ...(config.mistralApiKey !== undefined ? { mistralApiKey: config.mistralApiKey } : {}),
      ...(config.xaiApiKey !== undefined ? { xaiApiKey: config.xaiApiKey } : {}),
    },
    observability,
  )
  const sql = getDbClient(config.databaseUrl)
  const redisClient = getRedisClient(config.redisUrl)
  const scenarioRepository = new PostgresScenarioRepository(sql)
  const gmStateRepository = new PostgresGmStateRepository(sql)
  const sessionRepository = new PostgresSessionRepository(sql)
  const avatarRepository = new PostgresAvatarRepository(sql)
  const eventLogRepository = new PostgresEventLogRepository(sql)
  const conversationRepository = new PostgresConversationRepository(sql)
  const messageRepository = new PostgresMessageRepository(sql)
  const sessionMemoryRepository = new PostgresSessionMemoryRepository(sql)
  const avatarSessionMemoryRepository = new PostgresAvatarSessionMemoryRepository(sql)
  const conversationWorkingMemoryRepository = new PostgresConversationWorkingMemoryRepository(sql)
  const conversationMemoryRepository = new PostgresConversationMemoryRepository(sql)
  const userRepository = new PostgresUserRepository(sql)
  const userMemoryFactRepository = new PostgresUserMemoryFactRepository(sql)
  const knowledgeAdapters = buildKnowledgeAdapters(sql)
  const modelConfigRepository = new PostgresModelConfigRepository(sql)
  const sessionEventPublisher = new InMemorySessionEventPublisher()
  const memorySelectionService = new MemorySelectionService(
    messageRepository,
    conversationWorkingMemoryRepository,
    conversationMemoryRepository,
    userMemoryFactRepository,
  )
  const runGameMasterUseCase = new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llmAdapter,
    observability,
    scenarioRepository,
    eventLogRepository,
    conversationRepository,
    messageRepository,
    sessionEventPublisher,
    memorySelectionService,
  )
  const probes: IDependencyProbe[] = [
    new PostgresProbe(sql),
    new RedisProbe(redisClient),
    new LlmProbe(llmAdapter),
  ]

  const adapters = {
    llmAdapter,
    observabilityAdapter: observability,
    scenarioRepository,
    avatarRepository,
    eventLogRepository,
    gmStateRepository,
    sessionRepository,
    conversationRepository,
    messageRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    conversationWorkingMemoryRepository,
    conversationMemoryRepository,
    userRepository,
    userMemoryFactRepository,
    ...knowledgeAdapters,
    modelConfigRepository,
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
