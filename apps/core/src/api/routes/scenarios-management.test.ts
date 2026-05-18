import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { Session } from '../../domain/conversation/session.types.js'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    config: {},
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
    ...overrides,
  }
}

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Avatar',
    status: 'active',
    personaPrompt: 'You are a guide.',
    config: {},
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-21T10:00:00.000Z',
    lastActivityAt: '2026-04-21T10:00:00.000Z',
    ...overrides,
  }
}

function makeApp({
  scenarios = [],
  avatars = [],
  sessions = [],
}: {
  scenarios?: Scenario[]
  avatars?: AvatarConfig[]
  sessions?: Session[]
} = {}) {
  return createServer(TEST_CONFIG, {
    scenarioRepository: new InMemoryScenarioRepository(scenarios),
    avatarRepository: new InMemoryAvatarRepository(avatars),
    sessionRepository: new InMemorySessionRepository(sessions),
  })
}

describe('GET /v1/scenarios', () => {
  it('returns scenarios ordered by createdAt DESC', async () => {
    const app = makeApp({
      scenarios: [
        makeScenario({
          scenarioId: 'scenario_old',
          name: 'Older',
          createdAt: '2026-04-21T08:00:00.000Z',
          updatedAt: '2026-04-21T08:00:00.000Z',
        }),
        makeScenario({
          scenarioId: 'scenario_new',
          name: 'Newer',
          createdAt: '2026-04-21T09:00:00.000Z',
          updatedAt: '2026-04-21T09:00:00.000Z',
        }),
      ],
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body =
      response.json<
        ApiResponse<{ scenarios: Array<{ scenarioId: string; name: string; status: string }> }>
      >()
    expect(body.error).toBeNull()
    expect(body.data?.scenarios.map((scenario) => scenario.scenarioId)).toEqual([
      'scenario_new',
      'scenario_old',
    ])
    expect(body.data?.scenarios[0]).toMatchObject({ config: {} })
  })

  it('returns empty list when no scenarios exist', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ scenarios: unknown[] }>>()
    expect(body.error).toBeNull()
    expect(body.data?.scenarios).toEqual([])
  })
})

describe('GET /v1/scenarios/:scenarioId/avatars', () => {
  it('returns avatars for an existing scenario ordered by createdAt DESC', async () => {
    const app = makeApp({
      scenarios: [makeScenario({ scenarioId: 'scenario_1' })],
      avatars: [
        makeAvatar({
          avatarId: 'avatar_old',
          createdAt: '2026-04-21T08:00:00.000Z',
          updatedAt: '2026-04-21T08:00:00.000Z',
        }),
        makeAvatar({
          avatarId: 'avatar_new',
          createdAt: '2026-04-21T09:00:00.000Z',
          updatedAt: '2026-04-21T09:00:00.000Z',
        }),
      ],
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/scenarios/scenario_1/avatars',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ avatars: Array<{ avatarId: string }> }>>()
    expect(body.error).toBeNull()
    expect(body.data?.avatars.map((avatar) => avatar.avatarId)).toEqual([
      'avatar_new',
      'avatar_old',
    ])
    expect(body.data?.avatars[0]).toMatchObject({ config: {} })
  })

  it('returns 404 when scenario does not exist', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/scenarios/scenario_missing/avatars',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns 200 with empty avatars when scenario exists and has no avatars', async () => {
    const response = await makeApp({
      scenarios: [makeScenario({ scenarioId: 'scenario_1' })],
      avatars: [],
    }).inject({
      method: 'GET',
      url: '/v1/scenarios/scenario_1/avatars',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ avatars: unknown[] }>>()
    expect(body.error).toBeNull()
    expect(body.data?.avatars).toEqual([])
  })
})

describe('DELETE /v1/scenarios/:scenarioId', () => {
  it('deletes scenario when it has no avatars and sessions', async () => {
    const app = makeApp({
      scenarios: [makeScenario({ scenarioId: 'scenario_1' })],
      avatars: [],
      sessions: [],
    })

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/scenarios/scenario_1',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ scenarioId: string; deleted: true }>>()
    expect(body.error).toBeNull()
    expect(body.data).toEqual({ scenarioId: 'scenario_1', deleted: true })
  })

  it('returns 404 when scenario does not exist', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: '/v1/scenarios/scenario_missing',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns 409 when scenario has dependent avatars', async () => {
    const response = await makeApp({
      scenarios: [makeScenario({ scenarioId: 'scenario_1' })],
      avatars: [makeAvatar({ scenarioId: 'scenario_1' })],
      sessions: [],
    }).inject({
      method: 'DELETE',
      url: '/v1/scenarios/scenario_1',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(409)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('CONFLICT')
  })

  it('returns 409 when scenario has dependent sessions', async () => {
    const response = await makeApp({
      scenarios: [makeScenario({ scenarioId: 'scenario_1' })],
      avatars: [],
      sessions: [makeSession({ scenarioId: 'scenario_1', status: 'closed' })],
    }).inject({
      method: 'DELETE',
      url: '/v1/scenarios/scenario_1',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(409)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('CONFLICT')
  })
})
