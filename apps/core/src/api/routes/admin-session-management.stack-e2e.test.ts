import { describe, expect, it } from 'vitest'
import type { ApiResponse, ListSessionsResponse } from '@gami/shared'
import { prepareAndActivateAvatar } from './stack-e2e-current-fixtures.js'
import { STACK_SERVICE_KEY, stackPlayerHeaders } from './stack-e2e-auth.js'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const KEY_HEADERS = { 'x-admin-service-key': STACK_SERVICE_KEY }
const SERVICE_HEADERS = { 'content-type': 'application/json', ...KEY_HEADERS }

async function postJson<T>(path: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  return (await response.json()) as ApiResponse<T>
}

async function seedSessionsForTwoPlayers(): Promise<{ scenarioId: string; sessionIds: string[] }> {
  const scenario = await postJson<{ scenario: { scenarioId: string } }>(
    '/v1/admin/scenarios',
    SERVICE_HEADERS,
    { name: `Session management ${String(Date.now())}`, language: 'en' },
  )
  const scenarioId = scenario.data?.scenario.scenarioId ?? ''
  const avatar = await postJson<{ avatar: { avatarId: string } }>(
    `/v1/admin/scenarios/${scenarioId}/avatars`,
    SERVICE_HEADERS,
    { name: 'Management Avatar', personaPrompt: 'You are a guide.' },
  )
  await prepareAndActivateAvatar({
    appUrl: APP_URL,
    apiKey: STACK_SERVICE_KEY,
    scenarioId,
    avatarId: avatar.data?.avatar.avatarId ?? '',
  })
  const sessionIds: string[] = []
  for (const userId of [`stack_a_${crypto.randomUUID()}`, `stack_b_${crypto.randomUUID()}`]) {
    const session = await postJson<{ session: { sessionId: string } }>(
      '/v1/sessions',
      { ...stackPlayerHeaders(userId), 'content-type': 'application/json' },
      { scenarioId },
    )
    sessionIds.push(session.data?.session.sessionId ?? '')
  }
  return { scenarioId, sessionIds }
}

describe('Stack E2E — admin session management', () => {
  it('rejects listing without the admin credential (401)', async () => {
    expect((await fetch(`${APP_URL}/v1/admin/sessions`)).status).toBe(401)
  })

  it('rejects an invalid status filter (400)', async () => {
    const response = await fetch(`${APP_URL}/v1/admin/sessions?status=invalid`, {
      headers: SERVICE_HEADERS,
    })

    expect(response.status).toBe(400)
  })

  it('lists every player session of a scenario, deletes one, and then returns 404', async () => {
    const { scenarioId, sessionIds } = await seedSessionsForTwoPlayers()

    const list = await fetch(`${APP_URL}/v1/admin/sessions?scenarioId=${scenarioId}`, {
      headers: SERVICE_HEADERS,
    })
    const body = (await list.json()) as ApiResponse<ListSessionsResponse>
    expect(body.data?.sessions.map((session) => session.sessionId).sort()).toEqual(
      [...sessionIds].sort(),
    )

    const deleteUrl = `${APP_URL}/v1/admin/sessions/${sessionIds[0] ?? ''}`
    expect((await fetch(deleteUrl, { method: 'DELETE', headers: KEY_HEADERS })).status).toBe(200)
    expect((await fetch(deleteUrl, { method: 'DELETE', headers: KEY_HEADERS })).status).toBe(404)
  })
})

describe('Stack E2E — public scenario catalogue', () => {
  it('rejects a request without a player token (401)', async () => {
    expect((await fetch(`${APP_URL}/v1/scenarios`)).status).toBe(401)
  })

  it('lists active scenarios through the public projection only', async () => {
    const draft = await postJson<{ scenario: { scenarioId: string } }>(
      '/v1/admin/scenarios',
      SERVICE_HEADERS,
      { name: `Draft catalogue ${String(Date.now())}`, language: 'en' },
    )

    const response = await fetch(`${APP_URL}/v1/scenarios`, { headers: stackPlayerHeaders() })
    const body = (await response.json()) as ApiResponse<{
      scenarios: Record<string, unknown>[]
    }>

    expect(response.status).toBe(200)
    const ids = body.data?.scenarios.map((scenario) => scenario['scenarioId'])
    expect(ids).not.toContain(draft.data?.scenario.scenarioId)
    for (const scenario of body.data?.scenarios ?? []) {
      expect(
        Object.keys(scenario).every((key) => ['scenarioId', 'name', 'language'].includes(key)),
      ).toBe(true)
    }
  })
})
