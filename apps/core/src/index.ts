import { loadConfig } from './config.js'
import { createServer } from './api/server.js'
import { createObservabilityAdapter } from './infrastructure/observability/index.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const observability = createObservabilityAdapter(config)
  const server = createServer(config)

  async function shutdown(): Promise<void> {
    await observability.flush()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())

  try {
    await server.listen({ port: config.port, host: config.host })
  } catch (err) {
    server.log.error(err)
    await observability.flush()
    process.exit(1)
  }
}

await main()
