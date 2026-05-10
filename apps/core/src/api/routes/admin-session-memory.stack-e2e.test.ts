import { describe, expect, it } from 'vitest'
import type { ApiResponse, SessionMemoryLayers, SessionMemorySummary } from '@gami/shared'

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

async function postConversationMessage(conversationId: string, content: string): Promise<Response> {
  return fetch(buildUrl(`/v1/conversations/${conversationId}/messages`), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message: { content } }),
  })
}

function assertMemoryLayersEnvelope(
  body: ApiResponse<{ session: SessionMemoryLayers }>,
  sessionId: string,
): void {
  const session = body.data?.session
  expect(body.error).toBeNull()
  expect(session?.sessionId).toBe(sessionId)
  assertShortTermLayer(session)
  assertWorkingAndLongTermLayer(session)
  assertObservabilityLayer(session)
}

function assertShortTermLayer(session: SessionMemoryLayers | undefined): void {
  expect(session?.shortTerm.exchangeCount).toBe(3)
  expect(Array.isArray(session?.shortTerm.recentExchanges)).toBe(true)
  expect((session?.shortTerm.recentExchanges.length ?? 0) <= 3).toBe(true)
}

function assertWorkingAndLongTermLayer(session: SessionMemoryLayers | undefined): void {
  expect(Array.isArray(session?.working.avatars)).toBe(true)
  expect(Array.isArray(session?.longTerm.facts)).toBe(true)
}

function assertObservabilityLayer(session: SessionMemoryLayers | undefined): void {
  expect(session?.observability).toBeDefined()
  const selectedCount = session?.observability?.selection?.selectedCount
  const countIsValid = selectedCount === undefined || typeof selectedCount === 'number'
  expect(countIsValid).toBe(true)
  expect(Array.isArray(session?.observability?.selection?.topSelectionReasons ?? [])).toBe(true)
}

async function seedSession(): Promise<{
  sessionId: string
  userId: string
  conversationId: string
}> {
  const userId = `e2e_user_${crypto.randomUUID()}`
  const scenarioRes = await fetch(buildUrl('/v1/scenarios'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: `Memory Scenario ${String(Date.now())}` }),
  })
  const scenarioBody = (await scenarioRes.json()) as ApiResponse<{
    scenario: { scenarioId: string }
  }>
  const scenarioId = requireId(scenarioBody.data?.scenario, 'scenarioId')

  const avatarRes = await fetch(buildUrl(`/v1/scenarios/${scenarioId}/avatars`), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: 'Guide', personaPrompt: 'You are a helpful guide.' }),
  })
  const avatarBody = (await avatarRes.json()) as ApiResponse<{ avatar: { avatarId: string } }>
  const avatarId = requireId(avatarBody.data?.avatar, 'avatarId')

  const sessionRes = await fetch(buildUrl('/v1/sessions'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ userId, scenarioId }),
  })
  const sessionBody = (await sessionRes.json()) as ApiResponse<{ session: { sessionId: string } }>
  const sessionId = requireId(sessionBody.data?.session, 'sessionId')

  const convoRes = await fetch(buildUrl(`/v1/sessions/${sessionId}/conversations`), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ avatarId }),
  })
  const convoBody = (await convoRes.json()) as ApiResponse<{
    conversation: { conversationId: string }
  }>
  const conversationId = requireId(convoBody.data?.conversation, 'conversationId')
  return { sessionId, userId, conversationId }
}

describe('GET /v1/admin/sessions/:sessionId/memory — stack auth', () => {
  it('returns 401 without API key', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/memory'))
    expect(response.status).toBe(401)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /v1/admin/sessions/:sessionId/memory-layers — stack auth', () => {
  it('returns 401 without API key', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/memory-layers'))
    expect(response.status).toBe(401)
  })

  it('returns 401 with wrong API key', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/memory-layers'), {
      headers: authHeaders('wrong-secret'),
    })
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/sessions/:sessionId/memory — stack behavior', () => {
  it('returns 404 for unknown sessionId', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_missing/memory'), {
      headers: authHeaders(),
    })
    expect(response.status).toBe(404)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns empty summary and zero facts for known session with no summary/facts', async () => {
    const seeded = await seedSession()
    const response = await fetch(buildUrl(`/v1/admin/sessions/${seeded.sessionId}/memory`), {
      headers: authHeaders(),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as ApiResponse<{ session: SessionMemorySummary }>
    expect(body.error).toBeNull()
    expect(body.data?.session.summary).toBe('')
    expect(body.data?.session.longTermFactCount).toBe(0)
  })

  it('returns a valid memory summary envelope after conversation close compaction', async () => {
    const seeded = await seedSession()
    const messageRes = await fetch(
      buildUrl(`/v1/conversations/${seeded.conversationId}/messages`),
      {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ message: { content: 'Hello there' } }),
      },
    )
    expect(messageRes.status).toBe(200)

    const endRes = await fetch(
      buildUrl(`/v1/sessions/${seeded.sessionId}/conversations/${seeded.conversationId}/end`),
      {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: 'operator_end' }),
      },
    )
    expect(endRes.status).toBe(200)

    let summary: string | null = null
    for (let i = 0; i < 100; i += 1) {
      const memoryRes = await fetch(buildUrl(`/v1/admin/sessions/${seeded.sessionId}/memory`), {
        headers: authHeaders(),
      })
      const body = (await memoryRes.json()) as ApiResponse<{ session: SessionMemorySummary }>
      summary = body.data?.session.summary ?? null
      if (summary !== null) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(typeof summary).toBe('string')
  })

  it('returns a numeric longTermFactCount after real conversation close flow', async () => {
    const seeded = await seedSession()
    const messageRes = await fetch(
      buildUrl(`/v1/conversations/${seeded.conversationId}/messages`),
      {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ message: { content: 'I prefer tea over coffee.' } }),
      },
    )
    expect(messageRes.status).toBe(200)

    const endRes = await fetch(
      buildUrl(`/v1/sessions/${seeded.sessionId}/conversations/${seeded.conversationId}/end`),
      {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: 'operator_end' }),
      },
    )
    expect(endRes.status).toBe(200)

    const response = await fetch(buildUrl(`/v1/admin/sessions/${seeded.sessionId}/memory`), {
      headers: authHeaders(),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as ApiResponse<{ session: SessionMemorySummary }>
    expect(body.error).toBeNull()
    expect(typeof body.data?.session.longTermFactCount).toBe('number')
    expect((body.data?.session.longTermFactCount ?? -1) >= 0).toBe(true)
  })
})

describe('GET /v1/admin/sessions/:sessionId/memory-layers — stack behavior', () => {
  it('returns 404 for unknown sessionId', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_missing/memory-layers'), {
      headers: authHeaders(),
    })
    expect(response.status).toBe(404)
  })

  it('returns layered memory details in ApiResponse envelope', async () => {
    const seeded = await seedSession()
    const firstMessage = await postConversationMessage(
      seeded.conversationId,
      'First memory message',
    )
    expect(firstMessage.status).toBe(200)
    const secondMessage = await postConversationMessage(
      seeded.conversationId,
      'Second memory message',
    )
    expect(secondMessage.status).toBe(200)

    const response = await fetch(buildUrl(`/v1/admin/sessions/${seeded.sessionId}/memory-layers`), {
      headers: authHeaders(),
    })
    expect(response.status).toBe(200)
    const text = await response.text()
    const body = JSON.parse(text) as ApiResponse<{ session: SessionMemoryLayers }>
    assertMemoryLayersEnvelope(body, seeded.sessionId)
    expect(text).not.toContain('You are a helpful guide.')
    expect(text).not.toContain('OPENAI_API_KEY')
  })
})
