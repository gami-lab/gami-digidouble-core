import { loadConfig } from './config.js'
import { createServer } from './api/server.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const server = createServer(config)

  try {
    await server.listen({ port: config.port, host: config.host })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

await main()
