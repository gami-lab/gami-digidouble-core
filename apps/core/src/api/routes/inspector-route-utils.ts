import type { FastifyReply } from 'fastify'
import { fail } from '@gami/shared'
import { DomainError } from '../../domain/errors.js'

export type SessionParams = {
  sessionId: string
}

export const sessionParamsSchema = {
  type: 'object',
  required: ['sessionId'],
  properties: {
    sessionId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

export async function mapInspectorDomainError(
  error: unknown,
  reply: FastifyReply,
  options?: { internalLogMessage?: string },
): Promise<FastifyReply> {
  if (error instanceof DomainError && error.code === 'NOT_FOUND') {
    return await reply.status(404).send(fail('NOT_FOUND', error.message))
  }

  if (options?.internalLogMessage !== undefined) {
    reply.log.error({ err: error }, options.internalLogMessage)
  }
  return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
}
