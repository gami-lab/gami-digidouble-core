import { describe, expect, it } from 'vitest'
import type { ApiResponse, PlayerTokenResponse } from '@gami/shared'
import { prepareAndActivateAvatar } from './stack-e2e-current-fixtures.js'
import { STACK_SERVICE_KEY } from './stack-e2e-auth.js'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const SERVICE_HEADERS = {
  'content-type': 'application/json',
  'x-admin-service-key': STACK_SERVICE_KEY,
}

async function issuePlayer(token?: string): Promise<Response> {
  return await fetch(`${APP_URL}/v1/auth/player`, {
    method: 'POST',
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  })
}

async function createPlayer(): Promise<PlayerTokenResponse> {
  const response = await issuePlayer()
  expect(response.status).toBe(200)
  const body = (await response.json()) as ApiResponse<PlayerTokenResponse>
  if (body.data === null) throw new Error('Missing player token')
  return body.data
}

function bearer(player: PlayerTokenResponse): Record<string, string> {
  return { authorization: `Bearer ${player.token}`, 'content-type': 'application/json' }
}

async function postJson<T>(path: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as ApiResponse<T> }
}

async function seedOwnedConversation(owner: PlayerTokenResponse) {
  const scenario = await postJson<{ scenario: { scenarioId: string } }>(
    '/v1/admin/scenarios',
    SERVICE_HEADERS,
    { name: `Ownership scenario ${String(Date.now())}`, language: 'en' },
  )
  const scenarioId = scenario.body.data?.scenario.scenarioId ?? ''
  const avatar = await postJson<{ avatar: { avatarId: string } }>(
    `/v1/admin/scenarios/${scenarioId}/avatars`,
    SERVICE_HEADERS,
    { name: 'Ownership Avatar', personaPrompt: 'You are a guide.' },
  )
  const avatarId = avatar.body.data?.avatar.avatarId ?? ''
  await prepareAndActivateAvatar({
    appUrl: APP_URL,
    apiKey: STACK_SERVICE_KEY,
    scenarioId,
    avatarId,
  })

  const session = await postJson<{ session: { sessionId: string; userId: string } }>(
    '/v1/sessions',
    bearer(owner),
    { scenarioId },
  )
  expect(session.status).toBe(201)
  expect(session.body.data?.session.userId).toBe(owner.userId)
  const sessionId = session.body.data?.session.sessionId ?? ''
  const conversation = await postJson<{ conversation: { conversationId: string } }>(
    `/v1/sessions/${sessionId}/conversations`,
    bearer(owner),
    { avatarId },
  )
  expect(conversation.status).toBe(201)
  return { sessionId, conversationId: conversation.body.data?.conversation.conversationId ?? '' }
}

describe('Stack E2E — player authentication', () => {
  it('issues a usable player token (200)', async () => {
    const player = await createPlayer()

    const sessions = await fetch(`${APP_URL}/v1/sessions`, { headers: bearer(player) })

    expect(player.userId).toMatch(/^user_/)
    expect(sessions.status).toBe(200)
  })

  it('refreshes the same player with a valid token (200)', async () => {
    const player = await createPlayer()

    const response = await issuePlayer(player.token)
    const body = (await response.json()) as ApiResponse<PlayerTokenResponse>

    expect(response.status).toBe(200)
    expect(body.data?.userId).toBe(player.userId)
  })

  it('rejects a tampered token (401)', async () => {
    const player = await createPlayer()
    const tampered = `${player.token.slice(0, -2)}xx`

    expect((await issuePlayer(tampered)).status).toBe(401)
    const sessions = await fetch(`${APP_URL}/v1/sessions`, {
      headers: { authorization: `Bearer ${tampered}` },
    })
    expect(sessions.status).toBe(401)
  })

  it('rejects a public route without a token (401)', async () => {
    expect((await fetch(`${APP_URL}/v1/sessions`)).status).toBe(401)
  })

  it('rejects an invalid session start body (400)', async () => {
    const player = await createPlayer()

    const response = await postJson('/v1/sessions', bearer(player), {})

    expect(response.status).toBe(400)
  })

  it('refuses a player token on an admin route (403)', async () => {
    const player = await createPlayer()

    const response = await fetch(`${APP_URL}/v1/admin/scenarios`, { headers: bearer(player) })

    expect(response.status).toBe(403)
  })
})

describe('Stack E2E — cross-player ownership', () => {
  it("returns 404 for another player's session, history, runtime, events, and audio", async () => {
    const owner = await createPlayer()
    const intruder = await createPlayer()
    const { sessionId, conversationId } = await seedOwnedConversation(owner)

    const ownHistory = await fetch(`${APP_URL}/v1/conversations/${conversationId}/history`, {
      headers: bearer(owner),
    })
    expect(ownHistory.status).toBe(200)

    const requests: [string, string][] = [
      ['GET', `/v1/sessions/${sessionId}`],
      ['GET', `/v1/sessions/${sessionId}/runtime-state`],
      ['GET', `/v1/sessions/${sessionId}/events/stream`],
      ['GET', `/v1/conversations/${conversationId}/history`],
      ['POST', `/v1/conversations/${conversationId}/messages/message_1/audio`],
    ]
    for (const [method, path] of requests) {
      const response = await fetch(`${APP_URL}${path}`, {
        method,
        headers: bearer(intruder),
        ...(method === 'POST' ? { body: '{}' } : {}),
      })
      expect(`${method} ${path} ${String(response.status)}`).toBe(`${method} ${path} 404`)
    }

    const message = await postJson(
      `/v1/conversations/${conversationId}/messages`,
      bearer(intruder),
      {
        message: { content: 'Not my conversation' },
      },
    )
    expect(message.status).toBe(404)
  })
})
