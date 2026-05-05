import type { FastifyInstance } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { ISessionEventPublisher } from '../../application/ports/ISessionEventPublisher.js'
import { GetRuntimeStateUseCase } from '../../application/use-cases/get-runtime-state/get-runtime-state.use-case.js'
import type { GetRuntimeStateOutput } from '../../application/use-cases/get-runtime-state/get-runtime-state.types.js'
import { DomainError } from '../../domain/errors.js'

type SessionParams = {
  sessionId: string
}

const sessionParamsSchema = {
  type: 'object',
  required: ['sessionId'],
  properties: {
    sessionId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const KEEPALIVE_INTERVAL_MS = 30_000

export function registerRuntimeEventsRoutes(
  app: FastifyInstance,
  sessionRepository: ISessionRepository,
  publisher: ISessionEventPublisher,
  getRuntimeStateUseCase: GetRuntimeStateUseCase,
): void {
  registerGetRuntimeStateRoute(app, getRuntimeStateUseCase)
  registerStreamRuntimeEventsRoute(app, sessionRepository, publisher)
}

function registerGetRuntimeStateRoute(
  app: FastifyInstance,
  useCase: GetRuntimeStateUseCase,
): void {
  app.get<{ Params: SessionParams }>(
    '/:sessionId/runtime-state',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.status(200).send(ok<GetRuntimeStateOutput>(output))
      } catch (error) {
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          return await reply.status(404).send(fail('NOT_FOUND', error.message))
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}

function registerStreamRuntimeEventsRoute(
  app: FastifyInstance,
  sessionRepository: ISessionRepository,
  publisher: ISessionEventPublisher,
): void {
  app.get<{ Params: SessionParams }>(
    '/:sessionId/events/stream',
    { config: { rawBody: true }, schema: { params: sessionParamsSchema, response: {} } },
    async (request, reply) => {
      const { sessionId } = request.params
      const session = await sessionRepository.findById(sessionId)
      if (session === null) {
        return await reply.status(404).send(fail('NOT_FOUND', `Session '${sessionId}' not found`))
      }

      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('X-Accel-Buffering', 'no')
      reply.raw.write(': keepalive\n\n')

      request.log.info({ sessionId }, 'sse.connected')

      const keepaliveTimer = setInterval(() => {
        reply.raw.write(': keepalive\n\n')
      }, KEEPALIVE_INTERVAL_MS)

      const unsubscribe = publisher.subscribe(sessionId, (event) => {
        const frame =
          `event: runtime_event\n` + `id: ${event.eventId}\n` + `data: ${JSON.stringify(event)}\n\n`
        reply.raw.write(frame)
      })

      request.raw.on('close', () => {
        clearInterval(keepaliveTimer)
        unsubscribe()
        request.log.info({ sessionId }, 'sse.disconnected')
      })

      await reply.hijack()
    },
  )
}
