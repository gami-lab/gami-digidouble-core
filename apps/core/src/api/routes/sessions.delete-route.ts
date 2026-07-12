import type { FastifyInstance } from 'fastify'
import { fail, ok } from '@gami/shared'
import { DomainError } from '../../domain/errors.js'
import type { DeleteSessionUseCase } from '../../application/use-cases/delete-session/delete-session.use-case.js'
import type { DeleteSessionOutput } from '../../application/use-cases/delete-session/delete-session.types.js'

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

export function registerDeleteSessionRoute(
  app: FastifyInstance,
  useCase: DeleteSessionUseCase,
): void {
  app.delete<{ Params: SessionParams }>(
    '/:sessionId',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCase.execute({ sessionId: request.params.sessionId })
        return await reply.send(ok<DeleteSessionOutput>(output))
      } catch (error) {
        if (error instanceof DomainError && error.code === 'NOT_FOUND') {
          return await reply.status(404).send(fail('NOT_FOUND', error.message))
        }
        return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
      }
    },
  )
}
