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

function requireId<T extends Record<string, unknown>>(value: T | undefined, key: keyof T): string {
  const id = value?.[key]
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Missing required id: ${String(key)}`)
  }
  return id
}

describe('GET /v1/users/:userId/memory-facts — stack auth', () => {
  it('returns 401 without API key', async () => {
    const response = await fetch(buildUrl('/v1/users/e2e_user/memory-facts'))
    expect(response.status).toBe(401)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 with wrong API key', async () => {
    const response = await fetch(buildUrl('/v1/users/e2e_user/memory-facts'), {
      headers: authHeaders('wrong-key'),
    })
    expect(response.status).toBe(401)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /v1/users/:userId/memory-facts — stack behavior', () => {
  it('returns empty list for unknown user', async () => {
    const userId = `e2e_user_${crypto.randomUUID()}`
    const response = await fetch(buildUrl(`/v1/users/${userId}/memory-facts`), {
      headers: authHeaders(),
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as ApiResponse<{ facts: unknown[] }>
    expect(body.error).toBeNull()
    expect(body.data?.facts).toEqual([])
  })

  it('returns 200 envelope after real conversation close flow', async () => {
    const userId = `e2e_user_${crypto.randomUUID()}`
    const scenarioRes = await fetch(buildUrl('/v1/scenarios'), {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ name: `Memory Facts Scenario ${String(Date.now())}` }),
    })
    expect(scenarioRes.status).toBe(201)
    const scenarioBody = (await scenarioRes.json()) as ApiResponse<{
      scenario: { scenarioId: string }
    }>
    const scenarioId = requireId(scenarioBody.data?.scenario, 'scenarioId')

    const avatarRes = await fetch(buildUrl(`/v1/scenarios/${scenarioId}/avatars`), {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Guide', personaPrompt: 'You are a helpful guide.' }),
    })
    expect(avatarRes.status).toBe(201)
    const avatarBody = (await avatarRes.json()) as ApiResponse<{ avatar: { avatarId: string } }>
    const avatarId = requireId(avatarBody.data?.avatar, 'avatarId')

    const sessionRes = await fetch(buildUrl('/v1/sessions'), {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ userId, scenarioId }),
    })
    expect(sessionRes.status).toBe(201)
    const sessionBody = (await sessionRes.json()) as ApiResponse<{ session: { sessionId: string } }>
    const sessionId = requireId(sessionBody.data?.session, 'sessionId')

    const convoRes = await fetch(buildUrl(`/v1/sessions/${sessionId}/conversations`), {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ avatarId }),
    })
    expect(convoRes.status).toBe(201)
    const convoBody = (await convoRes.json()) as ApiResponse<{
      conversation: { conversationId: string }
    }>
    const conversationId = requireId(convoBody.data?.conversation, 'conversationId')

    const messageRes = await fetch(buildUrl(`/v1/conversations/${conversationId}/messages`), {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ message: { content: 'I enjoy strategy games.' } }),
    })
    expect(messageRes.status).toBe(200)

    const endRes = await fetch(
      buildUrl(`/v1/sessions/${sessionId}/conversations/${conversationId}/end`),
      {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'operator_end' }),
      },
    )
    expect(endRes.status).toBe(200)

    const response = await fetch(buildUrl(`/v1/users/${userId}/memory-facts`), {
      headers: authHeaders(),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as ApiResponse<{
      facts: Array<{
        id: string
        category: string
        key: string
        value: string
        confidence?: number | null
        updatedAt: string
      }>
    }>
    expect(body.error).toBeNull()
    expect(Array.isArray(body.data?.facts)).toBe(true)
    for (const fact of body.data?.facts ?? []) {
      expect(typeof fact.id).toBe('string')
      expect(typeof fact.category).toBe('string')
      expect(typeof fact.key).toBe('string')
      expect(typeof fact.value).toBe('string')
      expect(typeof fact.updatedAt).toBe('string')
    }
  })
})
