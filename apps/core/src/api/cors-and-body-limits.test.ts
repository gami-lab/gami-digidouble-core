import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { Config } from '../config.js'
import { createServer } from './server.js'
import { TEST_CONFIG } from './routes/test-config.js'
import { credentialHeaders, playerHeaders, serviceKeyHeaders } from './routes/test-auth.js'

const ADMIN_ORIGIN = 'http://admin.test'
const PLAYER_ORIGIN = 'http://player.test'
const config: Config = { ...TEST_CONFIG, playerOrigins: [PLAYER_ORIGIN] }

function preflight(url: string, origin: string, requestHeaders = 'content-type') {
  return createServer(config).inject({
    method: 'OPTIONS',
    url,
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': requestHeaders,
    },
  })
}

describe('per-tier CORS', () => {
  it('refuses a preflight from the player origin to an admin route', async () => {
    const response = await preflight('/v1/admin/scenarios', PLAYER_ORIGIN)

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
    expect(response.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it('allows the admin origin with credentials on admin routes', async () => {
    const response = await preflight('/v1/admin/auth/login', ADMIN_ORIGIN)

    expect(response.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN)
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('allows the player origin on player routes without credentials or the old key header', async () => {
    const response = await preflight(
      '/v1/conversations/conversation_1/messages',
      PLAYER_ORIGIN,
      'content-type,authorization',
    )

    expect(response.headers['access-control-allow-origin']).toBe(PLAYER_ORIGIN)
    expect(response.headers['access-control-allow-credentials']).toBeUndefined()
    const allowed = String(response.headers['access-control-allow-headers']).toLowerCase()
    expect(allowed).toContain('authorization')
    expect(allowed).not.toContain('x-api-key')
  })

  it('refuses a player route from an unknown origin', async () => {
    const response = await preflight('/v1/sessions', 'http://evil.test')

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('body limits', () => {
  it('rejects an oversized player JSON body with 400 VALIDATION_ERROR', async () => {
    const response = await createServer(config).inject({
      method: 'PUT',
      url: '/v1/me/persona',
      headers: { ...playerHeaders(), 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'x'.repeat(40 * 1024) }),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an oversized credential-free body before it reaches the handler', async () => {
    const response = await createServer(config).inject({
      method: 'POST',
      url: '/v1/admin/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ password: 'x'.repeat(8 * 1024) }),
    })

    expect(response.statusCode).toBe(400)
  })

  it('accepts authoring bodies larger than the player limit', async () => {
    const response = await createServer(config).inject({
      method: 'POST',
      url: '/v1/admin/scenarios',
      headers: { ...serviceKeyHeaders(), 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Large', worldContext: 'w'.repeat(200 * 1024) }),
    })

    expect(response.statusCode).toBe(201)
  })

  it('lets knowledge uploads exceed the default authoring limit', async () => {
    const response = await createServer(config).inject({
      method: 'POST',
      url: '/v1/admin/knowledge-sources/upload',
      headers: { ...credentialHeaders(), 'content-type': 'application/json' },
      payload: JSON.stringify({
        scenarioId: 'scenario_1',
        name: 'Big file',
        knowledgeType: 'world',
        visibilityPolicy: 'all',
        filename: 'notes.txt',
        content: Buffer.from('a'.repeat(2 * 1024 * 1024)).toString('base64'),
      }),
    })

    expect(response.statusCode).not.toBe(400)
  })
})
