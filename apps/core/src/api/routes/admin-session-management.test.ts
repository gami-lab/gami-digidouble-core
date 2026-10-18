import { describe, expect, it } from 'vitest'
import type { ApiResponse, ListSessionsResponse } from '@gami/shared'
import type { Session } from '../../domain/conversation/session.types.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const AUTH = { 'x-api-key': 'test-secret' }

function makeSession(overrides: Partial<Session>): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_a',
    unlockedAvatarIds: [],
    status: 'active',
    startedAt: '2026-10-18T10:00:00.000Z',
    lastActivityAt: '2026-10-18T10:00:00.000Z',
    ...overrides,
  }
}

function createSessionServer(sessionRepository: InMemorySessionRepository) {
  return createServer(TEST_CONFIG, { sessionRepository })
}

describe('/v1/admin/sessions — cross-user management', () => {
  it('lists sessions of every user for a scenario', async () => {
    const repository = new InMemorySessionRepository([
      makeSession({ sessionId: 'session_a1', userId: 'user_1' }),
      makeSession({ sessionId: 'session_a2', userId: 'user_2' }),
      makeSession({ sessionId: 'session_b1', scenarioId: 'scenario_b' }),
    ])

    const response = await createSessionServer(repository).inject({
      method: 'GET',
      url: '/v1/admin/sessions?scenarioId=scenario_a',
      headers: AUTH,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<ListSessionsResponse>>()
    expect(body.data?.sessions.map((session) => session.sessionId).sort()).toEqual([
      'session_a1',
      'session_a2',
    ])
  })

  it('rejects an invalid status filter', async () => {
    const response = await createSessionServer(new InMemorySessionRepository()).inject({
      method: 'GET',
      url: '/v1/admin/sessions?status=invalid',
      headers: AUTH,
    })

    expect(response.statusCode).toBe(400)
  })

  it('deletes a session and returns 404 once it is gone', async () => {
    const repository = new InMemorySessionRepository([makeSession({})])
    const app = createSessionServer(repository)

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/v1/admin/sessions/session_1',
      headers: AUTH,
    })
    const again = await app.inject({
      method: 'DELETE',
      url: '/v1/admin/sessions/session_1',
      headers: AUTH,
    })

    expect(deleted.statusCode).toBe(200)
    expect(await repository.findById('session_1')).toBeNull()
    expect(again.statusCode).toBe(404)
    expect(again.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })

  it('no longer serves session deletion on the public path', async () => {
    const response = await createSessionServer(
      new InMemorySessionRepository([makeSession({})]),
    ).inject({ method: 'DELETE', url: '/v1/sessions/session_1', headers: AUTH })

    expect(response.statusCode).toBe(404)
  })
})
