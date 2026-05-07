import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'

function buildUrl(path: string): string {
  return `${APP_URL}${path}`
}

function authHeaders(apiKey = API_KEY): Record<string, string> {
  return { 'x-api-key': apiKey }
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

function requireId<T extends Record<string, unknown>>(value: T | undefined, key: keyof T): string {
  const id = value?.[key]
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Missing required id: ${String(key)}`)
  }
  return id
}

async function seedConversation(): Promise<{ sessionId: string; conversationId: string }> {
  const scenarioRes = await postJson('/v1/scenarios', {
    name: `Admin Actions Scenario ${String(Date.now())}`,
  })
  expect(scenarioRes.status).toBe(201)
  const scenarioBody = (await scenarioRes.json()) as ApiResponse<{
    scenario: { scenarioId: string }
  }>
  const scenarioId = requireId(scenarioBody.data?.scenario, 'scenarioId')

  const avatarRes = await postJson(`/v1/scenarios/${scenarioId}/avatars`, {
    name: 'Action Guide',
    personaPrompt: 'You are a helpful guide.',
  })
  expect(avatarRes.status).toBe(201)
  const avatarBody = (await avatarRes.json()) as ApiResponse<{ avatar: { avatarId: string } }>
  const avatarId = requireId(avatarBody.data?.avatar, 'avatarId')

  const sessionRes = await postJson('/v1/sessions', {
    userId: `admin_actions_user_${crypto.randomUUID()}`,
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

  const messageRes = await postJson(`/v1/conversations/${conversationId}/messages`, {
    message: { content: 'Hello for admin actions' },
  })
  expect(messageRes.status).toBe(200)

  return { sessionId, conversationId }
}

describe('admin runtime actions auth', () => {
  it('replay gm requires auth', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/gm/replay'), {
      method: 'POST',
    })
    expect(response.status).toBe(401)
  })

  it('memory refresh requires auth', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/memory/refresh'), {
      method: 'POST',
    })
    expect(response.status).toBe(401)
  })

  it('memory clear requires auth', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/memory/clear'), {
      method: 'POST',
    })
    expect(response.status).toBe(401)
  })
})

describe('admin runtime actions not-found', () => {
  it('returns 404 for unknown session on replay gm', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_missing/gm/replay'), {
      method: 'POST',
      headers: authHeaders(),
    })
    expect(response.status).toBe(404)
  })

  it('returns 404 for unknown session on memory refresh', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_missing/memory/refresh'), {
      method: 'POST',
      headers: authHeaders(),
    })
    expect(response.status).toBe(404)
  })

  it('returns 404 for unknown session on memory clear', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_missing/memory/clear'), {
      method: 'POST',
      headers: authHeaders(),
    })
    expect(response.status).toBe(404)
  })
})

describe('admin runtime actions happy path', () => {
  it('schedules gm replay', async () => {
    const { sessionId } = await seedConversation()
    const response = await fetch(buildUrl(`/v1/admin/sessions/${sessionId}/gm/replay`), {
      method: 'POST',
      headers: authHeaders(),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as ApiResponse<{ action: string; scheduled: boolean }>
    expect(body.error).toBeNull()
    expect(body.data?.action).toBe('gm.replay')
    expect(body.data?.scheduled).toBe(true)
  })

  it('schedules memory refresh', async () => {
    const { sessionId } = await seedConversation()
    const response = await fetch(buildUrl(`/v1/admin/sessions/${sessionId}/memory/refresh`), {
      method: 'POST',
      headers: authHeaders(),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as ApiResponse<{ action: string; scheduled: boolean }>
    expect(body.data?.action).toBe('memory.refresh')
    expect(body.data?.scheduled).toBe(true)
  })

  it('clears session memory only', async () => {
    const { sessionId } = await seedConversation()
    const response = await fetch(buildUrl(`/v1/admin/sessions/${sessionId}/memory/clear`), {
      method: 'POST',
      headers: authHeaders(),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as ApiResponse<{
      action: string
      cleared: { userFactsCleared: boolean }
    }>
    expect(body.data?.action).toBe('memory.clear')
    expect(body.data?.cleared.userFactsCleared).toBe(false)
  })
})
