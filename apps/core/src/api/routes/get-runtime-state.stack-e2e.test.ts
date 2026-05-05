import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'

function authHeaders(apiKey = API_KEY): Record<string, string> {
  return { 'x-api-key': apiKey, 'content-type': 'application/json' }
}

async function createScenarioAndSession(): Promise<{ sessionId: string }> {
  const scenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name: `Runtime state stack scenario ${Date.now().toString()}` }),
  })
  expect(scenarioRes.status).toBe(201)
  const scenarioBody = (await scenarioRes.json()) as ApiResponse<{
    scenario: { scenarioId: string }
  }>
  const scenarioId = scenarioBody.data?.scenario.scenarioId
  if (typeof scenarioId !== 'string' || scenarioId.length === 0) {
    throw new Error('Missing scenarioId')
  }

  const sessionRes = await fetch(`${APP_URL}/v1/sessions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ userId: `user_${Date.now().toString()}`, scenarioId }),
  })
  expect(sessionRes.status).toBe(201)
  const sessionBody = (await sessionRes.json()) as ApiResponse<{
    session: { sessionId: string }
  }>
  const sessionId = sessionBody.data?.session.sessionId
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('Missing sessionId')
  }

  return { sessionId }
}

describe('Stack E2E — GET /v1/sessions/:sessionId/runtime-state auth', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const response = await fetch(`${APP_URL}/v1/sessions/session_1/runtime-state`)

    expect(response.status).toBe(401)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const response = await fetch(`${APP_URL}/v1/sessions/session_1/runtime-state`, {
      headers: authHeaders('wrong-key'),
    })

    expect(response.status).toBe(401)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('Stack E2E — GET /v1/sessions/:sessionId/runtime-state behavior', () => {
  it('returns 404 NOT_FOUND for unknown sessionId', async () => {
    const response = await fetch(`${APP_URL}/v1/sessions/session_unknown/runtime-state`, {
      headers: authHeaders(),
    })

    expect(response.status).toBe(404)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns runtimeState shape and null error for a valid session', async () => {
    const { sessionId } = await createScenarioAndSession()

    const response = await fetch(`${APP_URL}/v1/sessions/${sessionId}/runtime-state`, {
      headers: authHeaders(),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as ApiResponse<{
      runtimeState: {
        sessionId: string
        canSendMessage: boolean
        isProcessing: boolean
        updatedAt: string
      }
    }>

    expect(body.error).toBeNull()
    expect(body.data?.runtimeState.sessionId).toBe(sessionId)
    expect(typeof body.data?.runtimeState.canSendMessage).toBe('boolean')
    expect(typeof body.data?.runtimeState.isProcessing).toBe('boolean')
    expect(typeof body.data?.runtimeState.updatedAt).toBe('string')
    expect(Number.isNaN(Date.parse(body.data?.runtimeState.updatedAt ?? 'invalid'))).toBe(false)
  })
})
