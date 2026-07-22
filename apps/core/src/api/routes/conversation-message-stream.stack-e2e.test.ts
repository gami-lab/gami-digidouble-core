import { describe, expect, it } from 'vitest'
import type { ApiResponse, MessageStreamEvent } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'

function buildUrl(path: string): string {
  return `${APP_URL}${path}`
}

function authHeaders(apiKey = API_KEY): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'content-type': 'application/json',
  }
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(buildUrl(path), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
}

async function deleteJson(path: string): Promise<void> {
  await fetch(buildUrl(path), {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  })
}

async function cleanupFixture(ids: {
  sessionId: string
  avatarId: string
  scenarioId: string
}): Promise<void> {
  await deleteJson(`/v1/sessions/${ids.sessionId}`)
  await deleteJson(`/v1/avatars/${ids.avatarId}`)
  await deleteJson(`/v1/scenarios/${ids.scenarioId}`)
}

async function seedConversation(): Promise<{
  conversationId: string
  sessionId: string
  avatarId: string
  scenarioId: string
}> {
  const scenarioResponse = await postJson('/v1/scenarios', {
    name: `Message stream scenario ${String(Date.now())}`,
  })
  expect(scenarioResponse.status).toBe(201)
  const scenarioBody = (await scenarioResponse.json()) as ApiResponse<{
    scenario: { scenarioId: string }
  }>
  const scenarioId = requireId(scenarioBody.data?.scenario.scenarioId, 'scenarioId')

  const avatarResponse = await postJson(`/v1/scenarios/${scenarioId}/avatars`, {
    name: 'Stream Avatar',
    personaPrompt: 'You are a helpful streaming avatar.',
  })
  expect(avatarResponse.status).toBe(201)
  const avatarBody = (await avatarResponse.json()) as ApiResponse<{
    avatar: { avatarId: string }
  }>
  const avatarId = requireId(avatarBody.data?.avatar.avatarId, 'avatarId')

  const sessionResponse = await postJson('/v1/sessions', {
    userId: `stream_user_${crypto.randomUUID()}`,
    scenarioId,
  })
  expect(sessionResponse.status).toBe(201)
  const sessionBody = (await sessionResponse.json()) as ApiResponse<{
    session: { sessionId: string }
  }>
  const sessionId = requireId(sessionBody.data?.session.sessionId, 'sessionId')

  const conversationResponse = await postJson(`/v1/sessions/${sessionId}/conversations`, {
    avatarId,
  })
  expect(conversationResponse.status).toBe(201)
  const conversationBody = (await conversationResponse.json()) as ApiResponse<{
    conversation: { conversationId: string }
  }>
  const conversationId = requireId(
    conversationBody.data?.conversation.conversationId,
    'conversationId',
  )

  return { conversationId, sessionId, avatarId, scenarioId }
}

function requireId(value: string | undefined, label: string): string {
  if (value === undefined || value.length === 0) throw new Error(`Missing ${label}`)
  return value
}

async function postStream(
  conversationId: string,
  body: unknown,
  apiKey = API_KEY,
): Promise<{ response: Response; events: MessageStreamEvent[]; text: string }> {
  const response = await fetch(buildUrl(`/v1/conversations/${conversationId}/messages/stream`), {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  })
  const text = await response.text()
  return { response, events: parseSseEvents(text), text }
}

function parseSseEvents(text: string): MessageStreamEvent[] {
  return text
    .split(/\r?\n\r?\n/)
    .map((frame) => frame.split(/\r?\n/).find((line) => line.startsWith('data:')))
    .filter((line): line is string => line !== undefined)
    .map((line) => JSON.parse(line.slice(5).trim()) as MessageStreamEvent)
}

describe('Stack E2E — POST /v1/conversations/:conversationId/messages/stream auth', () => {
  it('returns 401 without an API key', async () => {
    const result = await postStream('conversation_1', { message: { content: 'Hello' } }, '')

    expect(result.response.status).toBe(401)
    const body = JSON.parse(result.text) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 with a wrong API key', async () => {
    const result = await postStream(
      'conversation_1',
      { message: { content: 'Hello' } },
      'wrong-stack-secret',
    )

    expect(result.response.status).toBe(401)
    const body = JSON.parse(result.text) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('Stack E2E — POST /v1/conversations/:conversationId/messages/stream validation', () => {
  it('returns 400 for missing message.content', async () => {
    const result = await postStream('conversation_1', { message: {} })

    expect(result.response.status).toBe(400)
    const body = JSON.parse(result.text) as ApiResponse<null>
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for empty message.content', async () => {
    const result = await postStream('conversation_1', { message: { content: '' } })

    expect(result.response.status).toBe(400)
    const body = JSON.parse(result.text) as ApiResponse<null>
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })
})

describe('Stack E2E — POST /v1/conversations/:conversationId/messages/stream not found', () => {
  it('returns 404 NOT_FOUND for an unknown conversation', async () => {
    const result = await postStream('conversation_unknown', { message: { content: 'Hello' } })

    expect(result.response.status).toBe(404)
    const body = JSON.parse(result.text) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('Stack E2E — POST /v1/conversations/:conversationId/messages/stream happy path', () => {
  it('returns ordered events ending with one canonical completion payload', async () => {
    const fixture = await seedConversation()

    try {
      const result = await postStream(fixture.conversationId, {
        message: { content: 'Hello over the stream' },
      })

      expect(result.response.status).toBe(200)
      expect(result.response.headers.get('content-type')).toContain('text/event-stream')
      expect(result.events.map((event) => event.type)).toContain('conversation.message.started')
      expect(
        result.events.filter((event) => event.type === 'conversation.message.completed'),
      ).toHaveLength(1)

      const deltaEvents = result.events.filter(
        (event): event is Extract<MessageStreamEvent, { type: 'conversation.message.delta' }> =>
          event.type === 'conversation.message.delta',
      )
      expect(deltaEvents.map((event) => event.sequence)).toEqual(
        deltaEvents.map((_, index) => index),
      )

      const lastEvent = result.events.at(-1)
      expect(lastEvent?.type).toBe('conversation.message.completed')
      if (lastEvent?.type !== 'conversation.message.completed') return

      expect(lastEvent.response.userMessage.content).toBe('Hello over the stream')
      expect(lastEvent.response.avatarMessage.role).toBe('avatar')
      expect(lastEvent.response.avatarMessage.content.length).toBeGreaterThan(0)
      expect(lastEvent.response.debug.requestId).toBe(lastEvent.requestId)
    } finally {
      await cleanupFixture(fixture)
    }
  })
})
