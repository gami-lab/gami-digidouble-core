import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'

function voiceHeaders(
  apiKey?: string,
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    'content-type': 'audio/webm',
    'x-utterance-id': `stack-utterance-${crypto.randomUUID()}`,
    ...(apiKey === undefined ? {} : { 'x-api-key': apiKey }),
    ...overrides,
  }
}

async function postVoice(
  path: string,
  options: { apiKey?: string; body?: Uint8Array; headers?: Record<string, string> } = {},
): Promise<Response> {
  return fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: options.headers ?? voiceHeaders(options.apiKey),
    body: options.body ?? Uint8Array.from([1, 2, 3]),
  })
}

async function expectApiError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status)
  const body = (await response.json()) as ApiResponse<null>
  expect(body.data).toBeNull()
  expect(body.error?.code).toBe(code)
}

describe('Stack E2E — voice message route authentication', () => {
  it.each([
    '/v1/conversations/conversation_unknown/voice-messages',
    '/v1/conversations/conversation_unknown/voice-messages/stream',
  ])('returns 401 without an API key for %s', async (path) => {
    await expectApiError(await postVoice(path), 401, 'UNAUTHORIZED')
  })

  it.each([
    '/v1/conversations/conversation_unknown/voice-messages',
    '/v1/conversations/conversation_unknown/voice-messages/stream',
  ])('returns 401 with a wrong API key for %s', async (path) => {
    await expectApiError(
      await postVoice(path, { apiKey: 'wrong-stack-secret' }),
      401,
      'UNAUTHORIZED',
    )
  })
})

describe('Stack E2E — voice message route validation', () => {
  it('returns 400 for missing utterance identity', async () => {
    const headers = voiceHeaders(API_KEY)
    delete headers['x-utterance-id']
    await expectApiError(
      await postVoice('/v1/conversations/conversation_unknown/voice-messages', { headers }),
      400,
      'VALIDATION_ERROR',
    )
  })

  it('returns 400 for an empty body on the streaming route', async () => {
    await expectApiError(
      await postVoice('/v1/conversations/conversation_unknown/voice-messages/stream', {
        apiKey: API_KEY,
        body: new Uint8Array(),
      }),
      400,
      'VALIDATION_ERROR',
    )
  })

  it('returns 400 for an unsupported media type', async () => {
    await expectApiError(
      await postVoice('/v1/conversations/conversation_unknown/voice-messages', {
        apiKey: API_KEY,
        headers: voiceHeaders(API_KEY, { 'content-type': 'application/octet-stream' }),
      }),
      400,
      'VALIDATION_ERROR',
    )
  })
})

describe('Stack E2E — voice message resource validation', () => {
  it.each([
    '/v1/conversations/conversation_unknown/voice-messages',
    '/v1/conversations/conversation_unknown/voice-messages/stream',
  ])('returns 404 NOT_FOUND for an unknown conversation on %s', async (path) => {
    await expectApiError(await postVoice(path, { apiKey: API_KEY }), 404, 'NOT_FOUND')
  })
})

// TODO(EPIC-9.1): Enable provider-backed sync and SSE happy-path assertions when the stack has a
// deterministic audio fixture plus configured Deepgram and Avatar providers.
describe('Stack E2E — voice message provider-backed success', () => {
  it.todo('returns SendMessageResponse for the synchronous route')
  it.todo('returns MessageStreamEvent frames for the streaming route')
})
