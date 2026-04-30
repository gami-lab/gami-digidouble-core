import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
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
import type { IDependencyProbe } from '../application/ports/IDependencyProbe.js'
import type { RunGameMasterUseCase } from '../application/use-cases/run-game-master/run-game-master.use-case.js'
import type { Config } from '../config.js'
import { InMemoryEventLogRepository } from '../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryGmStateRepository } from '../infrastructure/db/in-memory-gm-state.repository.js'
import { adminSessionsRoute } from './routes/admin-sessions.js'
import { adminHealthRoute } from './routes/admin-health.js'
import { avatarsRoute, type AvatarsRouteOptions } from './routes/avatars.js'
import { conversationsRoute } from './routes/conversations.js'
import { exchangeRoute } from './routes/exchange.js'
import { healthRoute } from './routes/health.js'
import { sessionsRoute } from './routes/sessions.js'
import { scenariosRoute, type ScenariosRouteOptions } from './routes/scenarios.js'

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
  probes?: IDependencyProbe[]
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
  const resolvedAdapters: ServerAdapters = {
    ...adapters,
    eventLogRepository: adapters.eventLogRepository ?? new InMemoryEventLogRepository(),
    gmStateRepository: adapters.gmStateRepository ?? new InMemoryGmStateRepository(),
  }

  const app = Fastify({
    logger: config.nodeEnv !== 'test' ? { level: config.logLevel } : false,
  })

  void app.register(cors, { origin: config.corsOrigin })

  app.setErrorHandler((error, _request, reply) => {
    if (isFastifyValidationError(error)) {
      return reply
        .status(400)
        .send(fail('VALIDATION_ERROR', 'Invalid request body', error.validation))
    }

    return reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
  })

  app.register(healthRoute)
  app.register(exchangeRoute, { config, ...resolvedAdapters })
  app.register(sessionsRoute, { prefix: '/v1/sessions', config, ...resolvedAdapters })
  app.register(conversationsRoute, {
    prefix: '/v1/conversations',
    config,
    ...resolvedAdapters,
  })
  app.register(adminSessionsRoute, {
    prefix: '/v1/admin',
    config,
    ...resolvedAdapters,
  })
  app.register(adminHealthRoute, {
    prefix: '/v1/admin',
    config,
    probes: adapters.probes ?? [],
  })
  app.register(scenariosRoute, {
    prefix: '/v1/scenarios',
    ...buildScenariosRouteOptions(config, resolvedAdapters),
  })
  app.register(avatarsRoute, {
    prefix: '/v1/avatars',
    ...buildAvatarsRouteOptions(config, resolvedAdapters),
  })

  return app
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
  }
}
