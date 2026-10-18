import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import { createServer } from './server.js'
import { TEST_CONFIG } from './routes/test-config.js'

const AUTH_HEADERS = { 'x-api-key': TEST_CONFIG.apiKeySecret }

function expectError(
  response: { statusCode: number; json: () => unknown },
  status: number,
  code: string,
) {
  expect(response.statusCode).toBe(status)
  const body = response.json() as ApiResponse<null>
  expect(body.data).toBeNull()
  expect(body.error?.code).toBe(code)
}

/**
 * A client sending `Content-Type: application/json` with an empty or malformed body — also the
 * natural call shape for a no-payload action route — must be classified as 400 VALIDATION_ERROR,
 * not fall through to the generic 500 branch.
 */
describe('global error handler — Fastify body-parsing errors', () => {
  it('returns 400 VALIDATION_ERROR (not 500) for an empty JSON body', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/admin/sessions/session_x/gm/replay',
      headers: { 'content-type': 'application/json', ...AUTH_HEADERS },
    })

    expectError(response, 400, 'VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR (not 500) for a malformed (non-empty, invalid) JSON body', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'content-type': 'application/json', ...AUTH_HEADERS },
      payload: '{not valid json',
    })

    expectError(response, 400, 'VALIDATION_ERROR')
  })
})

describe('authentication hook', () => {
  it('rejects an unauthenticated malformed JSON body with 401 before parsing it', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'content-type': 'application/json' },
      payload: '{not valid json',
    })

    expectError(response, 401, 'UNAUTHORIZED')
  })

  it.each([
    {
      name: 'voice upload',
      url: '/v1/conversations/conversation_1/voice-messages',
      contentType: 'audio/webm',
    },
    {
      name: 'voice stream',
      url: '/v1/conversations/conversation_1/voice-messages/stream',
      contentType: 'audio/webm',
    },
    {
      name: 'knowledge upload',
      url: '/v1/knowledge-sources/upload',
      contentType: 'application/json',
    },
    {
      name: 'message audio',
      url: '/v1/conversations/conversation_1/messages/message_1/audio',
      contentType: 'application/json',
    },
  ])(
    'rejects an unauthenticated $name with 401 without reading an oversized body',
    async ({ url, contentType }) => {
      const response = await createServer(TEST_CONFIG).inject({
        method: 'POST',
        url,
        headers: { 'content-type': contentType, 'x-api-key': 'wrong-secret' },
        payload: Buffer.alloc(11_000_000, 1),
      })

      expectError(response, 401, 'UNAUTHORIZED')
    },
  )

  it('serves the health check without a credential', async () => {
    const response = await createServer(TEST_CONFIG).inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
  })

  it('returns 404 for an unknown route rather than 401', async () => {
    const response = await createServer(TEST_CONFIG).inject({ method: 'GET', url: '/v1/nope' })

    expect(response.statusCode).toBe(404)
  })
})
