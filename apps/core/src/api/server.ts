import Fastify, { type FastifyInstance } from 'fastify'
import type { Config } from '../config.js'
import { healthRoute } from './routes/health.js'

export function createServer(config: Config): FastifyInstance {
  const app = Fastify({
    logger: config.nodeEnv !== 'test' ? { level: config.logLevel } : false,
  })

  app.register(healthRoute)

  return app
}
