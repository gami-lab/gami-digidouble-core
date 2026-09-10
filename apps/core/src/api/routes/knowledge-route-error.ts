import type { FastifyReply } from 'fastify'
import { fail } from '@gami/shared'
import { DomainError } from '../../domain/errors.js'

export async function handleKnowledgeRouteError(
  error: unknown,
  reply: FastifyReply,
): Promise<FastifyReply> {
  if (error instanceof DomainError && error.code === 'NOT_FOUND') {
    return await reply.status(404).send(fail('NOT_FOUND', error.message))
  }
  if (
    error instanceof DomainError &&
    (error.code === 'VALIDATION_ERROR' || error.code === 'INVALID_INPUT')
  ) {
    return await reply.status(400).send(fail('VALIDATION_ERROR', error.message))
  }
  if (error instanceof DomainError && error.code === 'CONFLICT') {
    return await reply.status(409).send(fail('CONFLICT', error.message))
  }
  reply.log.error({ err: error }, 'Unhandled knowledge route error')
  return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
}
