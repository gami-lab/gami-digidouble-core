import { loadConfig } from './config.js'
import { createServer } from './api/server.js'
import { RunGameMasterUseCase } from './application/use-cases/run-game-master/run-game-master.use-case.js'
import { createObservabilityAdapter } from './infrastructure/observability/index.js'
import { createLlmAdapter } from './infrastructure/llm/index.js'
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
} from './infrastructure/db/index.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const observability = createObservabilityAdapter(config)
  const llmAdapter = createLlmAdapter({
    provider: config.llmProvider,
    ...(config.openaiApiKey !== undefined ? { openaiApiKey: config.openaiApiKey } : {}),
    ...(config.anthropicApiKey !== undefined ? { anthropicApiKey: config.anthropicApiKey } : {}),
    ...(config.mistralApiKey !== undefined ? { mistralApiKey: config.mistralApiKey } : {}),
  })
  const sql = getDbClient(config.databaseUrl)
  const scenarioRepository = new PostgresScenarioRepository(sql)
  const gmStateRepository = new PostgresGmStateRepository(sql)
  const sessionRepository = new PostgresSessionRepository(sql)
  const avatarRepository = new PostgresAvatarRepository(sql)
  const eventLogRepository = new PostgresEventLogRepository(sql)
  const conversationRepository = new PostgresConversationRepository(sql)
  const messageRepository = new PostgresMessageRepository(sql)
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
  )

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
    runGameMasterUseCase,
  }
  const server = createServer(config, adapters)

  server.addHook('onClose', async () => {
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

await main()
