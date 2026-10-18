import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { AdminListSessionsQuery } from '@gami/shared'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import { DeleteSessionUseCase } from '../../application/use-cases/delete-session/delete-session.use-case.js'
import type { DeleteSessionOutput } from '../../application/use-cases/delete-session/delete-session.types.js'
import { ListSessionsUseCase } from '../../application/use-cases/list-sessions/list-sessions.use-case.js'
import type { ListSessionsOutput } from '../../application/use-cases/list-sessions/list-sessions.types.js'
import { DomainError } from '../../domain/errors.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { sessionParamsSchema, type SessionParams } from './inspector-route-utils.js'

export type AdminSessionManagementRouteOptions = {
  sessionRepository?: ISessionRepository
}

const listSessionsQuerySchema = {
  type: 'object',
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
    userId: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['active', 'closed', 'archived'] },
  },
  additionalProperties: false,
} as const

/** Cross-user session listing and deletion for operators. */
export const adminSessionManagementRoute: FastifyPluginCallback<
  AdminSessionManagementRouteOptions
> = (app, options) => {
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository()
  const listSessionsUseCase = new ListSessionsUseCase(sessionRepository)
  const deleteSessionUseCase = new DeleteSessionUseCase(sessionRepository)

  app.get<{ Querystring: AdminListSessionsQuery }>(
    '/sessions',
    { schema: { querystring: listSessionsQuerySchema } },
    async (request, reply) => {
      const output = await listSessionsUseCase.execute({
        ...(request.query.scenarioId !== undefined ? { scenarioId: request.query.scenarioId } : {}),
        ...(request.query.userId !== undefined ? { userId: request.query.userId } : {}),
        ...(request.query.status !== undefined ? { status: request.query.status } : {}),
      })
      return await reply.send(ok<ListSessionsOutput>(output))
    },
  )

  app.delete<{ Params: SessionParams }>(
    '/sessions/:sessionId',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await deleteSessionUseCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<DeleteSessionOutput>(output))
      } catch (error) {
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          return await reply.status(404).send(fail('NOT_FOUND', error.message))
        }
        throw error
      }
    },
  )
}
