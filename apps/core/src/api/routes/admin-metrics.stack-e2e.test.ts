import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'

function buildUrl(path: string): string {
  return `${APP_URL}${path}`
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
  // TODO(EPIC-4.3): add happy-path test once a stack-level session seeding utility exists
  // The shape is validated in admin-metrics.test.ts using injected stubs
  it.skip('returns 200 with turn metrics for a session with completed turns', () => {
    expect(true).toBe(true)
  })
})
