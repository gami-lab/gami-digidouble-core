import type { FastifyInstance } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { GetRuntimeStateResponse } from '@gami/shared'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { ISessionEventPublisher } from '../../application/ports/ISessionEventPublisher.js'
import { GetRuntimeStateUseCase } from '../../application/use-cases/get-runtime-state/get-runtime-state.use-case.js'
import {
  mapInspectorDomainError,
  sessionParamsSchema,
  type SessionParams,
} from './inspector-route-utils.js'
import { copyReplyHeadersToRaw } from './reply-headers.js'

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

function registerGetRuntimeStateRoute(app: FastifyInstance, useCase: GetRuntimeStateUseCase): void {
  app.get<{ Params: SessionParams }>(
    '/:sessionId/runtime-state',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.status(200).send(ok<GetRuntimeStateResponse>(output))
      } catch (error) {
        return await mapInspectorDomainError(error, reply)
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
    { schema: { params: sessionParamsSchema, response: {} } },
    async (request, reply) => {
      const { sessionId } = request.params
      const session = await sessionRepository.findById(sessionId)
      if (session === null) {
        return await reply.status(404).send(fail('NOT_FOUND', `Session '${sessionId}' not found`))
      }

      copyReplyHeadersToRaw(reply)
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

      reply.raw.on('close', () => {
        clearInterval(keepaliveTimer)
        unsubscribe()
        request.log.info({ sessionId }, 'sse.disconnected')
      })

      await reply.hijack()
    },
  )
}
