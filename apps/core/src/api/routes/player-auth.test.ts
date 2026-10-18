import { describe, expect, it } from 'vitest'
import type { ApiResponse, PlayerTokenResponse } from '@gami/shared'
import type { Conversation } from '../../domain/conversation/session.types.js'
import type { Session } from '../../domain/conversation/session.types.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'
import { playerHeaders, serviceKeyHeaders } from './test-auth.js'

const timestamps = {
  startedAt: '2026-10-18T10:00:00.000Z',
  lastActivityAt: '2026-10-18T10:00:00.000Z',
}

const sessionA: Session = {
  sessionId: 'session_a',
  userId: 'user_a',
  scenarioId: 'scenario_1',
  unlockedAvatarIds: [],
  status: 'active',
  ...timestamps,
}

const conversationA: Conversation = {
  conversationId: 'conversation_a',
  sessionId: 'session_a',
  avatarId: 'avatar_1',
  status: 'active',
  ...timestamps,
}

function createPlayerServer() {
  return createServer(TEST_CONFIG, {
    sessionRepository: new InMemorySessionRepository([sessionA]),
    conversationRepository: new InMemoryConversationRepository([conversationA]),
  })
}

async function issue(
  app: ReturnType<typeof createServer>,
  headers: Record<string, string> = {},
): Promise<{ statusCode: number; body: ApiResponse<PlayerTokenResponse> }> {
  const response = await app.inject({ method: 'POST', url: '/v1/auth/player', headers })
  return { statusCode: response.statusCode, body: response.json() }
}

describe('POST /v1/auth/player', () => {
  it('creates a new Core-generated player with a usable token', async () => {
    const app = createPlayerServer()

    const { statusCode, body } = await issue(app)
    const sessions = await app.inject({
      method: 'GET',
      url: '/v1/sessions',
      headers: { authorization: `Bearer ${body.data?.token ?? ''}` },
    })

    expect(statusCode).toBe(200)
    expect(body.data?.userId).toMatch(/^user_/)
    expect(body.data?.expiresAt).toEqual(expect.any(String))
    expect(sessions.statusCode).toBe(200)
  })

  it('refreshes the same player when called with a valid token', async () => {
    const { statusCode, body } = await issue(createPlayerServer(), playerHeaders('user_a'))

    expect(statusCode).toBe(200)
    expect(body.data?.userId).toBe('user_a')
  })

  it('rejects a tampered token instead of silently creating a new player', async () => {
    const { statusCode, body } = await issue(createPlayerServer(), {
      authorization: `Bearer ${playerHeaders('user_a').authorization.slice(7)}x`,
    })

    expect(statusCode).toBe(401)
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('public route credentials', () => {
  it.each([
    ['no credential', {}],
    ['the old shared API key header', { 'x-api-key': 'legacy-shared-key' }],
    ['the admin service key', serviceKeyHeaders()],
    ['a malformed bearer token', { authorization: 'Bearer forged.token' }],
  ])('rejects %s with 401', async (_label, headers) => {
    const response = await createPlayerServer().inject({
      method: 'GET',
      url: '/v1/sessions/session_a',
      headers,
    })

    expect(response.statusCode).toBe(401)
  })

  it("lists only the caller's sessions even when the query names another user", async () => {
    const response = await createPlayerServer().inject({
      method: 'GET',
      url: '/v1/sessions?userId=user_a',
      headers: playerHeaders('user_b'),
    })

    expect(response.json<ApiResponse<{ sessions: unknown[] }>>().data?.sessions).toEqual([])
  })
})

describe('player ownership', () => {
  const foreignRequests = [
    ['GET', '/v1/sessions/session_a'],
    ['POST', '/v1/sessions/session_a/reset'],
    ['GET', '/v1/sessions/session_a/conversations'],
    ['POST', '/v1/sessions/session_a/conversations'],
    ['POST', '/v1/sessions/session_a/conversations/conversation_a/end'],
    ['POST', '/v1/sessions/session_a/switch-avatar'],
    ['GET', '/v1/sessions/session_a/available-avatars'],
    ['GET', '/v1/sessions/session_a/avatar-transitions'],
    ['GET', '/v1/sessions/session_a/runtime-state'],
    ['GET', '/v1/sessions/session_a/events/stream'],
    ['GET', '/v1/conversations/conversation_a/history'],
    ['POST', '/v1/conversations/conversation_a/messages'],
    ['POST', '/v1/conversations/conversation_a/messages/stream'],
    ['POST', '/v1/conversations/conversation_a/voice-messages'],
    ['POST', '/v1/conversations/conversation_a/voice-messages/stream'],
    ['POST', '/v1/conversations/conversation_a/messages/message_1/audio'],
  ] as const

  it.each(foreignRequests)(
    '%s %s owned by another player returns the same 404 as an unknown id',
    async (method, url) => {
      const app = createPlayerServer()

      const foreign = await app.inject({ method, url, headers: playerHeaders('user_b') })
      const unknown = await app.inject({
        method,
        url: url
          .replace('session_a', 'session_none')
          .replace('conversation_a', 'conversation_none'),
        headers: playerHeaders('user_b'),
      })

      expect(foreign.statusCode).toBe(404)
      expect(foreign.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
      expect(unknown.statusCode).toBe(404)
      expect(Object.keys(foreign.json<ApiResponse<null>>())).toEqual(
        Object.keys(unknown.json<ApiResponse<null>>()),
      )
    },
  )

  it('serves the owner', async () => {
    const app = createPlayerServer()

    const session = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_a',
      headers: playerHeaders('user_a'),
    })
    const history = await app.inject({
      method: 'GET',
      url: '/v1/conversations/conversation_a/history',
      headers: playerHeaders('user_a'),
    })

    expect(session.statusCode).toBe(200)
    expect(history.statusCode).toBe(200)
  })
})

describe('POST /v1/admin/player-tokens', () => {
  it('issues a token acting as an existing player for operator tools', async () => {
    const app = createPlayerServer()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/player-tokens',
      headers: serviceKeyHeaders(),
      payload: { userId: 'user_a' },
    })
    const token = response.json<ApiResponse<PlayerTokenResponse>>().data?.token ?? ''
    const session = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_a',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(201)
    expect(session.statusCode).toBe(200)
  })

  it('rejects an invalid body', async () => {
    const response = await createPlayerServer().inject({
      method: 'POST',
      url: '/v1/admin/player-tokens',
      headers: serviceKeyHeaders(),
      payload: { userId: 'has space' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('refuses a player token', async () => {
    const response = await createPlayerServer().inject({
      method: 'POST',
      url: '/v1/admin/player-tokens',
      headers: playerHeaders('user_a'),
      payload: { userId: 'user_b' },
    })

    expect(response.statusCode).toBe(403)
  })
})
