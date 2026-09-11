import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { processSseFrames } from '@gami/shared'
import type { ApiResponse, MessageStreamEvent, SendMessageResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'
const VOICE_STACK_E2E = process.env['VOICE_STACK_E2E'] === '1'
const VOICE_STACK_E2E_AUDIO_PATH = process.env['VOICE_STACK_E2E_AUDIO_PATH']
const VOICE_STACK_E2E_MEDIA_TYPE = process.env['VOICE_STACK_E2E_MEDIA_TYPE'] ?? 'audio/wav'

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
  options: { apiKey?: string; body?: Uint8Array | Buffer; headers?: Record<string, string> } = {},
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

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function deleteJson(path: string): Promise<void> {
  await fetch(`${APP_URL}${path}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  })
}

function parseEvents(body: string): MessageStreamEvent[] {
  const events: MessageStreamEvent[] = []
  processSseFrames(body, (event) => events.push(event as MessageStreamEvent))
  return events
}

function requireId(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0) throw new Error(`Missing ${name}`)
  return value
}

async function seedConversation(): Promise<{
  scenarioId: string
  avatarId: string
  sessionId: string
  conversationId: string
}> {
  const scenario = await postJson('/v1/scenarios', {
    name: `Voice stack e2e ${String(Date.now())}`,
  })
  expect(scenario.status).toBe(201)
  const scenarioBody = (await scenario.json()) as ApiResponse<{ scenario: { scenarioId: string } }>
  const scenarioId = requireId(scenarioBody.data?.scenario.scenarioId, 'scenarioId')

  const avatar = await postJson(`/v1/scenarios/${scenarioId}/avatars`, {
    name: 'Voice Stack Avatar',
    personaPrompt: 'You are a concise helpful assistant.',
  })
  expect(avatar.status).toBe(201)
  const avatarBody = (await avatar.json()) as ApiResponse<{ avatar: { avatarId: string } }>
  const avatarId = requireId(avatarBody.data?.avatar.avatarId, 'avatarId')

  const session = await postJson('/v1/sessions', {
    userId: `voice_stack_${crypto.randomUUID()}`,
    scenarioId,
  })
  expect(session.status).toBe(201)
  const sessionBody = (await session.json()) as ApiResponse<{ session: { sessionId: string } }>
  const sessionId = requireId(sessionBody.data?.session.sessionId, 'sessionId')

  const conversation = await postJson(`/v1/sessions/${sessionId}/conversations`, { avatarId })
  expect(conversation.status).toBe(201)
  const conversationBody = (await conversation.json()) as ApiResponse<{
    conversation: { conversationId: string }
  }>
  const conversationId = requireId(
    conversationBody.data?.conversation.conversationId,
    'conversationId',
  )

  return { scenarioId, avatarId, sessionId, conversationId }
}

async function cleanupFixture(ids: {
  scenarioId: string
  avatarId: string
  sessionId: string
}): Promise<void> {
  await deleteJson(`/v1/sessions/${ids.sessionId}`)
  await deleteJson(`/v1/avatars/${ids.avatarId}`)
  await deleteJson(`/v1/scenarios/${ids.scenarioId}`)
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

describe('Stack E2E — voice message provider-backed success', () => {
  const enabled = VOICE_STACK_E2E && VOICE_STACK_E2E_AUDIO_PATH !== undefined

  it.skipIf(!enabled)('returns SendMessageResponse for the synchronous route', async () => {
    const audio = await readFile(VOICE_STACK_E2E_AUDIO_PATH as string)
    const fixture = await seedConversation()

    try {
      const response = await postVoice(
        `/v1/conversations/${fixture.conversationId}/voice-messages`,
        {
          apiKey: API_KEY,
          body: audio,
          headers: voiceHeaders(API_KEY, {
            'content-type': VOICE_STACK_E2E_MEDIA_TYPE,
            'x-utterance-id': `voice-stack-sync-${crypto.randomUUID()}`,
          }),
        },
      )

      expect(response.status).toBe(200)
      const body = (await response.json()) as ApiResponse<SendMessageResponse>
      expect(body.error).toBeNull()
      expect(body.data?.userMessage.role).toBe('user')
      expect((body.data?.userMessage.content.length ?? 0) > 0).toBe(true)
      expect(body.data?.avatarMessage.role).toBe('avatar')
      expect((body.data?.avatarMessage.content.length ?? 0) > 0).toBe(true)
    } finally {
      await cleanupFixture(fixture)
    }
  })

  it.skipIf(!enabled)(
    'returns ordered MessageStreamEvent frames for the streaming route',
    async () => {
      const audio = await readFile(VOICE_STACK_E2E_AUDIO_PATH as string)
      const fixture = await seedConversation()

      try {
        const response = await postVoice(
          `/v1/conversations/${fixture.conversationId}/voice-messages/stream`,
          {
            apiKey: API_KEY,
            body: audio,
            headers: voiceHeaders(API_KEY, {
              'content-type': VOICE_STACK_E2E_MEDIA_TYPE,
              'x-utterance-id': `voice-stack-stream-${crypto.randomUUID()}`,
            }),
          },
        )

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('text/event-stream')
        const events = parseEvents(await response.text())
        expect(events.map((event) => event.type)).toContain('conversation.message.started')
        expect(
          events.filter((event) => event.type === 'conversation.message.completed'),
        ).toHaveLength(1)
        const deltas = events.filter(
          (event): event is Extract<MessageStreamEvent, { type: 'conversation.message.delta' }> =>
            event.type === 'conversation.message.delta',
        )
        expect(deltas.map((event) => event.sequence)).toEqual(deltas.map((_, index) => index))
        expect(events.at(-1)?.type).toBe('conversation.message.completed')
      } finally {
        await cleanupFixture(fixture)
      }
    },
  )
})
