import { describe, expect, it } from 'vitest'
import postgres from 'postgres'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'
const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/gami_core'

function buildUrl(path: string): string {
  return `${APP_URL}${path}`
}

function authHeaders(apiKey = API_KEY): Record<string, string> {
  return { 'x-api-key': apiKey }
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

  it('returns seeded facts and confidence null when not set', async () => {
    const userId = `e2e_user_${crypto.randomUUID()}`
    const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} })
    try {
      await sql`
        INSERT INTO user_memory_facts (user_id, category, key, value, confidence)
        VALUES
          (${userId}, 'preference', 'language', 'English', NULL),
          (${userId}, 'identity', 'role', 'friend', 0.9)
      `
    } finally {
      await sql.end()
    }

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
    expect(body.data?.facts).toHaveLength(2)
    for (const fact of body.data?.facts ?? []) {
      expect(typeof fact.id).toBe('string')
      expect(typeof fact.category).toBe('string')
      expect(typeof fact.key).toBe('string')
      expect(typeof fact.value).toBe('string')
      expect(typeof fact.updatedAt).toBe('string')
    }
    const language = body.data?.facts.find((fact) => fact.key === 'language')
    expect(language?.confidence).toBeNull()
  })
})
