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
})
