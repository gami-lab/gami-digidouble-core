import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import { stackCredentialHeaders } from './stack-e2e-auth.js'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['API_KEY'] ?? 'e2e-stack-secret-0123456789abcdef0123'
const PERSONA_URL = `${APP_URL}/v1/me/persona`

function playerJsonHeaders(userId: string): Record<string, string> {
  return { ...stackCredentialHeaders(API_KEY, userId), 'content-type': 'application/json' }
}

describe('PUT /v1/me/persona — stack auth and validation', () => {
  it('returns 401 without a player token', async () => {
    const response = await fetch(PERSONA_URL, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sam' }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 401 with a forged token', async () => {
    const response = await fetch(PERSONA_URL, {
      method: 'PUT',
      headers: { ...stackCredentialHeaders('wrong-key'), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sam' }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid persona payload', async () => {
    const response = await fetch(PERSONA_URL, {
      method: 'PUT',
      headers: playerJsonHeaders(`e2e_user_${crypto.randomUUID()}`),
      body: JSON.stringify({ avatarRelationships: 'invalid' }),
    })
    expect(response.status).toBe(400)
  })
})

describe('GET /v1/me/persona — stack null behavior', () => {
  it('returns 200 with null persona for a player without one', async () => {
    const response = await fetch(PERSONA_URL, {
      headers: playerJsonHeaders(`e2e_unknown_${crypto.randomUUID()}`),
    })
    expect(response.status).toBe(200)

    const body = (await response.json()) as ApiResponse<{ persona: null }>
    expect(body.error).toBeNull()
    expect(body.data?.persona).toBeNull()
  })
})

describe('PUT + GET /v1/me/persona — stack roundtrip', () => {
  it("upserts the player's persona, reads it back, and keeps it from other players", async () => {
    const userId = `e2e_user_${crypto.randomUUID()}`
    const persona = {
      name: 'Sam Carter',
      roleInWorld: 'mentor',
      avatarRelationships: ['Friend of Eva', 'Brother of Tom'],
      dialogGuidance: 'Use practical and concise explanations.',
    }

    const putResponse = await fetch(PERSONA_URL, {
      method: 'PUT',
      headers: playerJsonHeaders(userId),
      body: JSON.stringify(persona),
    })
    expect(putResponse.status).toBe(200)

    const getResponse = await fetch(PERSONA_URL, { headers: playerJsonHeaders(userId) })
    const body = (await getResponse.json()) as ApiResponse<{ persona: typeof persona }>
    expect(body.data?.persona).toEqual(persona)

    const otherResponse = await fetch(PERSONA_URL, {
      headers: playerJsonHeaders(`e2e_other_${crypto.randomUUID()}`),
    })
    const otherBody = (await otherResponse.json()) as ApiResponse<{ persona: null }>
    expect(otherBody.data?.persona).toBeNull()
  })
})
