import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret'

function buildUrl(path: string): string {
  return `${APP_URL}${path}`
}

describe('PUT /v1/users/:userId/persona — stack auth and validation', () => {
  it('returns 401 without API key', async () => {
    const response = await fetch(buildUrl('/v1/users/e2e_user/persona'), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sam' }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 401 with wrong API key', async () => {
    const response = await fetch(buildUrl('/v1/users/e2e_user/persona'), {
      method: 'PUT',
      headers: {
        'x-api-key': 'wrong-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sam' }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid persona payload', async () => {
    const response = await fetch(buildUrl('/v1/users/e2e_user/persona'), {
      method: 'PUT',
      headers: {
        'x-api-key': API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ avatarRelationships: 'invalid' }),
    })
    expect(response.status).toBe(400)
  })
})

describe('GET /v1/users/:userId/persona — stack auth and null behavior', () => {
  it('returns 401 without API key', async () => {
    const response = await fetch(buildUrl('/v1/users/e2e_unknown/persona'))
    expect(response.status).toBe(401)
  })

  it('returns 200 with null persona for unknown user', async () => {
    const unknownUserId = `e2e_unknown_${crypto.randomUUID()}`
    const response = await fetch(buildUrl(`/v1/users/${unknownUserId}/persona`), {
      headers: { 'x-api-key': API_KEY },
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as ApiResponse<{ persona: null }>
    expect(body.error).toBeNull()
    expect(body.data?.persona).toBeNull()
  })
})

describe('PUT + GET /v1/users/:userId/persona — stack roundtrip', () => {
  it('upserts persona then reads it back', async () => {
    const userId = `e2e_user_${crypto.randomUUID()}`
    const persona = {
      name: 'Sam Carter',
      roleInWorld: 'mentor',
      avatarRelationships: ['Friend of Eva', 'Brother of Tom'],
      dialogGuidance: 'Use practical and concise explanations.',
    }

    const putResponse = await fetch(buildUrl(`/v1/users/${userId}/persona`), {
      method: 'PUT',
      headers: {
        'x-api-key': API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(persona),
    })
    expect(putResponse.status).toBe(200)
    const putBody = (await putResponse.json()) as ApiResponse<{ user: { userId: string } }>
    expect(putBody.error).toBeNull()
    expect(putBody.data?.user.userId).toBe(userId)

    const getResponse = await fetch(buildUrl(`/v1/users/${userId}/persona`), {
      headers: { 'x-api-key': API_KEY },
    })
    expect(getResponse.status).toBe(200)
    const getBody = (await getResponse.json()) as ApiResponse<{ persona: typeof persona | null }>
    expect(getBody.error).toBeNull()
    expect(getBody.data?.persona).toEqual(persona)
  })
})
