import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import { createServer } from './server.js'
import { TEST_CONFIG } from './routes/test-config.js'

/**
 * Regression coverage for the global error handler's handling of Fastify's
 * own body-parsing errors (distinct from AJV schema validation errors).
 *
 * A client sending `Content-Type: application/json` with a completely empty
 * body — a common client mistake, and also the natural call shape for a
 * no-payload action route like `POST /v1/scenarios/:scenarioId/prepare-avatar-traits`
 * — used to fall through to the generic 500 INTERNAL_ERROR branch instead of
 * being classified as a 400 VALIDATION_ERROR.
 */
describe('global error handler — Fastify body-parsing errors', () => {
  it('returns 400 VALIDATION_ERROR (not 500) for an empty JSON body on an unauthenticated request', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/scenarios/scenario_unknown/prepare-avatar-traits',
      headers: { 'content-type': 'application/json' },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR (not 500) for an empty JSON body with a wrong API key', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/admin/sessions/session_x/gm/replay',
      headers: { 'content-type': 'application/json', 'x-api-key': 'wrong-secret' },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR (not 500) for a malformed (non-empty, invalid) JSON body', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'content-type': 'application/json' },
      payload: '{not valid json',
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })
})
