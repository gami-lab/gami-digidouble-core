import { loadConfig } from './config.js'
import { createServer } from './api/server.js'
import { createObservabilityAdapter } from './infrastructure/observability/index.js'
import {
  getDbClient,
  closeDbClient,
  PostgresScenarioRepository,
  PostgresAvatarRepository,
  PostgresGmStateRepository,
  PostgresSessionRepository,
  PostgresConversationRepository,
  PostgresMessageRepository,
} from './infrastructure/db/index.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const observability = createObservabilityAdapter(config)
  const sql = getDbClient(config.databaseUrl)

  const adapters = {
    observabilityAdapter: observability,
    scenarioRepository: new PostgresScenarioRepository(sql),
    avatarRepository: new PostgresAvatarRepository(sql),
    gmStateRepository: new PostgresGmStateRepository(sql),
    sessionRepository: new PostgresSessionRepository(sql),
    conversationRepository: new PostgresConversationRepository(sql),
    messageRepository: new PostgresMessageRepository(sql),
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
