import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse, SessionMemorySummary } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../../config.js'
import type { Session } from '../../domain/conversation/session.types.js'
import type { UserFact } from '../../domain/memory/memory.types.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { createServer } from '../server.js'

const testConfig: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  corsOrigin: '*',
  llmProvider: 'null',
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
}

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:05:00.000Z',
    ...overrides,
  }
}

function makeFact(overrides: Partial<UserFact> = {}): UserFact {
  return {
    id: 'umf_1',
    userId: 'user_1',
    category: 'preference',
    key: 'language',
    value: 'English',
    confidence: 0.8,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeApp(params?: { sessions?: Session[]; facts?: UserFact[] }): FastifyInstance {
  const app = createServer(testConfig, {
    sessionRepository: new InMemorySessionRepository(params?.sessions ?? [makeSession()]),
    userMemoryFactRepository: new InMemoryUserMemoryFactRepository(params?.facts ?? []),
  })
  appsToClose.push(app)
  return app
}

describe('GET /v1/admin/sessions/:sessionId/memory', () => {
  it('returns 401 without API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 with wrong API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
      headers: authHeaders('wrong'),
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 404 for unknown session', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/missing/memory',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns empty summary when session has no memorySummary', async () => {
    const response = await makeApp({
      sessions: [makeSession()],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ session: SessionMemorySummary }>>()
    expect(body.error).toBeNull()
    expect(body.data?.session.summary).toBe('')
  })

  it('returns session summary when present', async () => {
    const response = await makeApp({
      sessions: [makeSession({ memorySummary: 'Compacted memory summary' })],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ session: SessionMemorySummary }>>()
    expect(body.error).toBeNull()
    expect(body.data?.session.summary).toBe('Compacted memory summary')
    expect(body.data?.session.shortTerm).toEqual({ exchangeCount: 2 })
    expect(body.data?.session.updatedAt).toBe('2026-05-01T10:05:00.000Z')
  })

  it('returns longTermFactCount from seeded facts', async () => {
    const response = await makeApp({
      facts: [makeFact({ id: 'umf_1' }), makeFact({ id: 'umf_2', key: 'role', value: 'friend' })],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ session: SessionMemorySummary }>>()
    expect(body.error).toBeNull()
    expect(body.data?.session.longTermFactCount).toBe(2)
  })
})
