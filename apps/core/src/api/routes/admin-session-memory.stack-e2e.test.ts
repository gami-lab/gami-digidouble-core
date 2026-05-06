import { describe, expect, it } from 'vitest'
import postgres from 'postgres'
import type { ApiResponse, SessionMemorySummary } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'
const STACK_E2E_DATABASE_URL = process.env['STACK_E2E_DATABASE_URL']
const itIfDb = STACK_E2E_DATABASE_URL === undefined ? it.skip : it

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

async function seedFacts(userId: string, count: number): Promise<void> {
  const databaseUrl = STACK_E2E_DATABASE_URL
  if (databaseUrl === undefined) {
    throw new Error('STACK_E2E_DATABASE_URL is required for DB seeding scenarios')
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  try {
    for (let i = 0; i < count; i += 1) {
      await sql`
        INSERT INTO user_memory_facts (user_id, category, key, value)
        VALUES (${userId}, 'context', ${`fact_${String(i)}`}, ${`value_${String(i)}`})
      `
    }
  } finally {
    await sql.end()
  }
}

describe('GET /v1/admin/sessions/:sessionId/memory — stack auth', () => {
  it('returns 401 without API key', async () => {
    const response = await fetch(buildUrl('/v1/admin/sessions/session_1/memory'))
    expect(response.status).toBe(401)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
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

  it('returns non-empty summary after conversation close compaction', async () => {
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

    let summary = ''
    for (let i = 0; i < 20; i += 1) {
      const memoryRes = await fetch(buildUrl(`/v1/admin/sessions/${seeded.sessionId}/memory`), {
        headers: authHeaders(),
      })
      const body = (await memoryRes.json()) as ApiResponse<{ session: SessionMemorySummary }>
      summary = body.data?.session.summary ?? ''
      if (summary.length > 0) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(summary.length).toBeGreaterThan(0)
  })

  itIfDb('returns longTermFactCount of 3 for session user with seeded facts', async () => {
    const seeded = await seedSession()
    await seedFacts(seeded.userId, 3)

    const response = await fetch(buildUrl(`/v1/admin/sessions/${seeded.sessionId}/memory`), {
      headers: authHeaders(),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as ApiResponse<{ session: SessionMemorySummary }>
    expect(body.error).toBeNull()
    expect(body.data?.session.longTermFactCount).toBe(3)
  })
})
