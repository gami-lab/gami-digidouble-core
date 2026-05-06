import { describe, expect, it } from 'vitest'
import postgres from 'postgres'
import type { ApiResponse } from '@gami/shared'

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

async function seedFact(params: {
  userId: string
  category?: string
  key?: string
  value?: string
}): Promise<string> {
  const databaseUrl = STACK_E2E_DATABASE_URL
  if (databaseUrl === undefined) {
    throw new Error('STACK_E2E_DATABASE_URL is required for DB seeding scenarios')
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  try {
    const [row] = await sql<Array<{ id: string }>>`
      INSERT INTO user_memory_facts (user_id, category, key, value)
      VALUES (
        ${params.userId},
        ${params.category ?? 'preference'},
        ${params.key ?? `k_${crypto.randomUUID().slice(0, 8)}`},
        ${params.value ?? 'value'}
      )
      RETURNING id
    `
    if (row === undefined) throw new Error('Failed to seed fact')
    return row.id
  } finally {
    await sql.end()
  }
}

describe('DELETE /v1/users/:userId/memory-facts/:factId — stack auth', () => {
  it('returns 401 without API key', async () => {
    const response = await fetch(buildUrl('/v1/users/u1/memory-facts/umf_missing'), {
      method: 'DELETE',
    })
    expect(response.status).toBe(401)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('DELETE /v1/users/:userId/memory-facts/:factId — stack behavior', () => {
  it('returns 404 when fact does not exist', async () => {
    const response = await fetch(buildUrl('/v1/users/u1/memory-facts/umf_missing'), {
      method: 'DELETE',
      headers: authHeaders(),
    })
    expect(response.status).toBe(404)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  itIfDb('returns 404 when fact belongs to a different user', async () => {
    const factId = await seedFact({ userId: `e2e_user_${crypto.randomUUID()}` })
    const response = await fetch(buildUrl(`/v1/users/e2e_other_user/memory-facts/${factId}`), {
      method: 'DELETE',
      headers: authHeaders(),
    })
    expect(response.status).toBe(404)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  itIfDb('deletes valid fact and second delete returns 404', async () => {
    const userId = `e2e_user_${crypto.randomUUID()}`
    const factId = await seedFact({ userId })

    const first = await fetch(buildUrl(`/v1/users/${userId}/memory-facts/${factId}`), {
      method: 'DELETE',
      headers: authHeaders(),
    })
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as ApiResponse<{ factId: string; deleted: true }>
    expect(firstBody.error).toBeNull()
    expect(firstBody.data).toEqual({ factId, deleted: true })

    const second = await fetch(buildUrl(`/v1/users/${userId}/memory-facts/${factId}`), {
      method: 'DELETE',
      headers: authHeaders(),
    })
    expect(second.status).toBe(404)
    const secondBody = (await second.json()) as ApiResponse<null>
    expect(secondBody.error?.code).toBe('NOT_FOUND')
  })
})
