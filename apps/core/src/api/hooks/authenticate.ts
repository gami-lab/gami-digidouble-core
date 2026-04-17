import { timingSafeEqual } from 'node:crypto'
import type { preHandlerAsyncHookHandler } from 'fastify'
import { fail } from '@gami/shared'

function readApiKey(rawApiKey: string | string[] | undefined): string | undefined {
  if (typeof rawApiKey === 'string') return rawApiKey
  return rawApiKey?.[0]
}

function areApiKeysEqual(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  if (receivedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

export function authenticateApiKey(apiKeySecret: string): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    const apiKey = readApiKey(request.headers['x-api-key'])

    if (apiKey !== undefined && areApiKeysEqual(apiKey, apiKeySecret)) return

    return reply.status(401).send(fail('UNAUTHORIZED', 'Invalid API key'))
  }
}
