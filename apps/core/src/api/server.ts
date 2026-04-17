import Fastify, { type FastifyInstance } from 'fastify'
import { fail } from '@gami/shared'
import type { ILlmAdapter } from '../application/ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../application/ports/IObservabilityAdapter.js'
import type { Config } from '../config.js'
import { exchangeRoute } from './routes/exchange.js'
import { healthRoute } from './routes/health.js'

export interface ServerAdapters {
  llmAdapter?: ILlmAdapter
  observabilityAdapter?: IObservabilityAdapter
}

export function createServer(config: Config, adapters: ServerAdapters = {}): FastifyInstance {
  const app = Fastify({
    logger: config.nodeEnv !== 'test' ? { level: config.logLevel } : false,
  })

  app.setErrorHandler((error, _request, reply) => {
    if (typeof error === 'object' && error !== null && 'validation' in error) {
      return reply
        .status(400)
        .send(
          fail(
            'VALIDATION_ERROR',
            'Invalid request body',
            (error as { validation: unknown }).validation,
          ),
        )
    }

    return reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
  })

  app.register(healthRoute)
  app.register(exchangeRoute, { config, ...adapters })

  return app
}
