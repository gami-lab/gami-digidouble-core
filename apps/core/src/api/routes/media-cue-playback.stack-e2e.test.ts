import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ApiResponse, CreateScenarioResponse, StartSessionResponse } from '@gami/shared'
import { STACK_SERVICE_KEY, stackPlayerHeaders } from './stack-e2e-auth.js'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const ADMIN = { 'x-admin-service-key': STACK_SERVICE_KEY, 'content-type': 'application/json' }
const CUE_ID = `cue_${'0'.repeat(32)}`

function report(sessionId: string, body: unknown, headers: Record<string, string>) {
  return fetch(`${APP_URL}/v1/sessions/${sessionId}/media-cues/${CUE_ID}/playback`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Stack E2E — POST /v1/sessions/:sessionId/media-cues/:cueId/playback', () => {
  let scenarioId = ''
  let sessionId = ''

  beforeAll(async () => {
    const scenario = await fetch(`${APP_URL}/v1/admin/scenarios`, {
      method: 'POST',
      headers: ADMIN,
      body: JSON.stringify({ name: 'Playback stack scenario', status: 'active', language: 'en' }),
    })
    scenarioId =
      ((await scenario.json()) as ApiResponse<CreateScenarioResponse>).data?.scenario.scenarioId ??
      ''
    const session = await fetch(`${APP_URL}/v1/sessions`, {
      method: 'POST',
      headers: { ...stackPlayerHeaders('playback_player'), 'content-type': 'application/json' },
      body: JSON.stringify({ scenarioId }),
    })
    sessionId =
      ((await session.json()) as ApiResponse<StartSessionResponse>).data?.session.sessionId ?? ''
  })

  afterAll(async () => {
    await fetch(`${APP_URL}/v1/admin/sessions/${sessionId}`, { method: 'DELETE', headers: ADMIN })
    await fetch(`${APP_URL}/v1/admin/scenarios/${scenarioId}`, {
      method: 'DELETE',
      headers: { 'x-admin-service-key': STACK_SERVICE_KEY },
    })
  })

  it('returns 401 without a player token', async () => {
    expect((await report(sessionId, { outcome: 'started' }, {})).status).toBe(401)
  })

  it('returns 400 for an invalid body', async () => {
    const response = await report(
      sessionId,
      { outcome: 'paused' },
      stackPlayerHeaders('playback_player'),
    )
    expect(response.status).toBe(400)
  })

  it('returns 404 for an unknown cue, an unknown session, and another player session', async () => {
    const own = stackPlayerHeaders('playback_player')
    const statuses = await Promise.all([
      report(sessionId, { outcome: 'started' }, own),
      report('session_00000000-0000-4000-8000-000000000000', { outcome: 'started' }, own),
      report(sessionId, { outcome: 'started' }, stackPlayerHeaders('someone_else')),
    ])
    expect(statuses.map((response) => response.status)).toEqual([404, 404, 404])
  })
})
