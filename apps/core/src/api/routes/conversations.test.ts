import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { Config } from '../../config.js'
import type { Session } from '../../domain/conversation/session.types.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'

const testConfig: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  llmProvider: 'null',
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
}

type SessionSummary = {
  sessionId: string
  userId: string
  scenarioId: string
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string | null
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'sess_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
    endedAt: null,
    ...overrides,
  }
}

function makeApp({ sessions = [makeSession()] }: { sessions?: Session[] } = {}) {
  return createServer(testConfig, {
    sessionRepository: new InMemorySessionRepository(sessions),
    messageRepository: new InMemoryMessageRepository(),
  })
}

describe('POST /v1/conversations/start', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/start',
      payload: { userId: 'user_1', scenarioId: 'scenario_1' },
    })
    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/start',
      headers: { 'x-api-key': 'wrong-secret' },
      payload: { userId: 'user_1', scenarioId: 'scenario_1' },
    })
    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when userId is blank', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/start',
      headers: { 'x-api-key': 'test-secret' },
      payload: { userId: '', scenarioId: 'scenario_1' },
    })
    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when scenarioId is blank', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/start',
      headers: { 'x-api-key': 'test-secret' },
      payload: { userId: 'user_1', scenarioId: '' },
    })
    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 201 with a created session', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/start',
      headers: { 'x-api-key': 'test-secret' },
      payload: { userId: 'user_1', scenarioId: 'scenario_1' },
    })
    expect(response.statusCode).toBe(201)

    const body = response.json<ApiResponse<{ session: SessionSummary }>>()
    expect(body.error).toBeNull()
    const data = body.data as { session: SessionSummary }
    expect(data.session.sessionId.startsWith('session_')).toBe(true)
    expect(data.session.userId).toBe('user_1')
    expect(data.session.scenarioId).toBe('scenario_1')
    expect(data.session.status).toBe('active')
  })
})

describe('GET /v1/conversations/:sessionId/history', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/conversations/sess_1/history',
    })
    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 when session is unknown', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'GET',
      url: '/v1/conversations/missing/history',
      headers: { 'x-api-key': 'test-secret' },
    })
    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns 200 with session and empty messages', async () => {
    const response = await makeApp({ sessions: [makeSession()] }).inject({
      method: 'GET',
      url: '/v1/conversations/sess_1/history',
      headers: { 'x-api-key': 'test-secret' },
    })
    expect(response.statusCode).toBe(200)

    const body = response.json<ApiResponse<{ session: SessionSummary; messages: unknown[] }>>()
    expect(body.error).toBeNull()
    const data = body.data as { session: SessionSummary; messages: unknown[] }
    expect(data.session.sessionId).toBe('sess_1')
    expect(data.messages).toEqual([])
  })
})

describe('DELETE /v1/conversations/:sessionId', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: '/v1/conversations/sess_1',
    })
    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 when session is unknown', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'DELETE',
      url: '/v1/conversations/missing',
      headers: { 'x-api-key': 'test-secret' },
    })
    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns 200 and deleted.messages as 0 for existing session', async () => {
    const response = await makeApp({ sessions: [makeSession()] }).inject({
      method: 'DELETE',
      url: '/v1/conversations/sess_1',
      headers: { 'x-api-key': 'test-secret' },
    })
    expect(response.statusCode).toBe(200)

    const body = response.json<
      ApiResponse<{
        sessionId: string
        deleted: { messages: number; sessionMemory: boolean; events: number }
      }>
    >()
    expect(body.error).toBeNull()
    const data = body.data as {
      sessionId: string
      deleted: { messages: number; sessionMemory: boolean; events: number }
    }
    expect(data.sessionId).toBe('sess_1')
    expect(data.deleted.messages).toBe(0)
    expect(data.deleted.sessionMemory).toBe(false)
    expect(data.deleted.events).toBe(0)
  })
})
