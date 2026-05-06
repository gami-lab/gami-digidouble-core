import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'

function buildUrl(path: string): string {
  return `${APP_URL}${path}`
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function requireId<T extends Record<string, unknown>>(value: T | undefined, key: keyof T): string {
  const id = value?.[key]
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Missing required id: ${String(key)}`)
  }
  return id
}

async function seedConversation(): Promise<{ sessionId: string; conversationId: string }> {
  const scenarioRes = await postJson('/v1/scenarios', {
    name: `Metrics Scenario ${String(Date.now())}`,
  })
  expect(scenarioRes.status).toBe(201)
  const scenarioBody = (await scenarioRes.json()) as ApiResponse<{
    scenario: { scenarioId: string }
  }>
  const scenarioId = requireId(scenarioBody.data?.scenario, 'scenarioId')

  const avatarRes = await postJson(`/v1/scenarios/${scenarioId}/avatars`, {
    name: 'Metrics Guide',
    personaPrompt: 'You are a helpful guide.',
  })
  expect(avatarRes.status).toBe(201)
  const avatarBody = (await avatarRes.json()) as ApiResponse<{ avatar: { avatarId: string } }>
  const avatarId = requireId(avatarBody.data?.avatar, 'avatarId')

  const sessionRes = await postJson('/v1/sessions', {
    userId: `metrics_user_${crypto.randomUUID()}`,
    scenarioId,
  })
  expect(sessionRes.status).toBe(201)
  const sessionBody = (await sessionRes.json()) as ApiResponse<{ session: { sessionId: string } }>
  const sessionId = requireId(sessionBody.data?.session, 'sessionId')

  const conversationRes = await postJson(`/v1/sessions/${sessionId}/conversations`, { avatarId })
  expect(conversationRes.status).toBe(201)
  const conversationBody = (await conversationRes.json()) as ApiResponse<{
    conversation: { conversationId: string }
  }>
  const conversationId = requireId(conversationBody.data?.conversation, 'conversationId')

  return { sessionId, conversationId }
}

describe('GET /v1/admin/sessions/:id/metrics — stack auth', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/metrics'))
    expect(response.status).toBe(401)
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/metrics'), {
      headers: { 'x-api-key': 'wrong-key' },
    })
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/sessions/:id/metrics — stack not found', () => {
  it('returns 404 envelope for unknown session', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_missing/metrics'), {
      headers: { 'x-api-key': API_KEY },
    })
    expect(response.status).toBe(404)

    const body = (await response.json()) as ApiResponse<null>
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('GET /v1/admin/sessions/:id/metrics — stack happy path', () => {
  it('returns 200 with turn metrics for a session with completed turns', async () => {
    const { sessionId, conversationId } = await seedConversation()

    const messageRes = await postJson(`/v1/conversations/${conversationId}/messages`, {
      message: { content: 'Hello metrics test' },
    })
    expect(messageRes.status).toBe(200)

    const response = await fetch(buildUrl(`/v1/admin/sessions/${sessionId}/metrics`), {
      headers: { 'x-api-key': API_KEY },
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as ApiResponse<{
      sessionId: string
      summary: { totalTurns: number; turnsWithGm: number; avgAvatarLatencyMs: number }
      turns: Array<{ turnIndex: number; hasGm: boolean; avatarLatencyMs: number }>
    }>
    expect(body.error).toBeNull()
    expect(body.data?.sessionId).toBe(sessionId)
    expect(body.data?.summary.totalTurns).toBeGreaterThanOrEqual(1)
    expect(body.data?.summary.avgAvatarLatencyMs).toBeGreaterThan(0)
    expect(body.data?.turns.length).toBeGreaterThanOrEqual(1)
    const firstTurn = body.data?.turns.at(0)
    expect(firstTurn?.turnIndex).toBe(1)
    expect(typeof firstTurn?.hasGm).toBe('boolean')
    expect(typeof firstTurn?.avatarLatencyMs).toBe('number')
  })
})
