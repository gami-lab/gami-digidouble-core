import { describe, expect, it } from 'vitest'
import type { ApiResponse, AdminSessionContextResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'

function buildUrl(path: string): string {
  return `${APP_URL}${path}`
}

function authHeaders(apiKey = API_KEY): Record<string, string> {
  return { 'x-api-key': apiKey }
}

function requireId<T extends Record<string, unknown>>(value: T | undefined, key: keyof T): string {
  const id = value?.[key]
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Missing required id: ${String(key)}`)
  }
  return id
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function deleteJson(path: string): Promise<void> {
  await fetch(buildUrl(path), { method: 'DELETE', headers: authHeaders() })
}

async function cleanupSession(ids: {
  sessionId: string
  avatarId: string
  scenarioId: string
}): Promise<void> {
  await deleteJson(`/v1/sessions/${ids.sessionId}`)
  await deleteJson(`/v1/avatars/${ids.avatarId}`)
  await deleteJson(`/v1/scenarios/${ids.scenarioId}`)
}

async function seedSession(): Promise<{
  sessionId: string
  conversationId: string
  avatarId: string
  scenarioId: string
}> {
  const scenarioRes = await postJson('/v1/scenarios', {
    name: `Context Scenario ${String(Date.now())}`,
    config: { worldContext: 'Context world', objectives: ['Goal A'] },
  })
  expect(scenarioRes.status).toBe(201)
  const scenarioBody = (await scenarioRes.json()) as ApiResponse<{
    scenario: { scenarioId: string }
  }>
  const scenarioId = requireId(scenarioBody.data?.scenario, 'scenarioId')

  const avatarRes = await postJson(`/v1/scenarios/${scenarioId}/avatars`, {
    name: 'Context Guide',
    personaPrompt: 'You are a helpful guide.',
  })
  expect(avatarRes.status).toBe(201)
  const avatarBody = (await avatarRes.json()) as ApiResponse<{ avatar: { avatarId: string } }>
  const avatarId = requireId(avatarBody.data?.avatar, 'avatarId')

  const sessionRes = await postJson('/v1/sessions', {
    userId: `context_user_${crypto.randomUUID()}`,
    scenarioId,
  })
  expect(sessionRes.status).toBe(201)
  const sessionBody = (await sessionRes.json()) as ApiResponse<{ session: { sessionId: string } }>
  const sessionId = requireId(sessionBody.data?.session, 'sessionId')

  const convoRes = await postJson(`/v1/sessions/${sessionId}/conversations`, { avatarId })
  expect(convoRes.status).toBe(201)
  const convoBody = (await convoRes.json()) as ApiResponse<{
    conversation: { conversationId: string }
  }>
  const conversationId = requireId(convoBody.data?.conversation, 'conversationId')

  return { sessionId, conversationId, avatarId, scenarioId }
}

describe('GET /v1/admin/sessions/:sessionId/context — stack auth', () => {
  it('returns 401 without API key', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/context'))
    expect(response.status).toBe(401)
  })

  it('returns 401 with wrong API key', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/context'), {
      headers: authHeaders('wrong-secret'),
    })
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/sessions/:sessionId/context — stack not found', () => {
  it('returns 404 for unknown session', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_missing/context'), {
      headers: authHeaders(),
    })
    expect(response.status).toBe(404)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('GET /v1/admin/sessions/:sessionId/context — stack happy path', () => {
  it('returns the stable session context snapshot', async () => {
    const seeded = await seedSession()
    try {
      const messageRes = await postJson(`/v1/conversations/${seeded.conversationId}/messages`, {
        message: { content: 'Hello context endpoint' },
      })
      expect(messageRes.status).toBe(200)

      const response = await fetch(buildUrl(`/v1/admin/sessions/${seeded.sessionId}/context`), {
        headers: authHeaders(),
      })
      expect(response.status).toBe(200)
      const text = await response.text()
      const body = JSON.parse(text) as ApiResponse<AdminSessionContextResponse>
      assertStackContextBody(body, seeded.sessionId)
      assertStackContextRedaction(text)
    } finally {
      await cleanupSession(seeded)
    }
  })
})

function assertStackContextBody(
  body: ApiResponse<AdminSessionContextResponse>,
  sessionId: string,
): void {
  assertStackContextCoreShape(body, sessionId)
  assertStackContextTraceBounds(body)
}

function assertStackContextCoreShape(
  body: ApiResponse<AdminSessionContextResponse>,
  sessionId: string,
): void {
  expect(body.error).toBeNull()
  expect(body.data?.sessionId).toBe(sessionId)
  expect(body.data?.avatarContext.sections.worldContext.scenarioId).toBeDefined()
  expect(Array.isArray(body.data?.avatarContext.sections.responseRules.items)).toBe(true)
  expect(Array.isArray(body.data?.gmContext.sections.conversationState.recentMessages)).toBe(true)
  expect(body.data?.contextTrace.deterministic).toBe(true)
}

function assertStackContextTraceBounds(body: ApiResponse<AdminSessionContextResponse>): void {
  expect(
    (body.data?.avatarContext.sections.conversationState.recentExchanges.length ?? 0) >= 1,
  ).toBe(true)
}

function assertStackContextRedaction(rawBody: string): void {
  expect(rawBody).not.toContain('OPENAI_API_KEY')
  expect(rawBody).not.toContain('systemPrompt')
}
