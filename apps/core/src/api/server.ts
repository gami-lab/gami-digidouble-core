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

export function createServer(config: Config, adapters: ServerAdapters = {}): FastifyInstance {
  const app = Fastify({
    logger: config.nodeEnv !== 'test' ? { level: config.logLevel } : false,
  })

  app.setErrorHandler((error, _request, reply) => {
    if (isFastifyValidationError(error)) {
      return reply
        .status(400)
        .send(fail('VALIDATION_ERROR', 'Invalid request body', error.validation))
    }

    return reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
  })

  app.register(healthRoute)
  app.register(exchangeRoute, { config, ...adapters })

  return app
}
