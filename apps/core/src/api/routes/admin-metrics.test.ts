import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { StoredEvent } from '../../application/ports/IEventLogRepository.js'
import type { Config } from '../../config.js'
import type { Session } from '../../domain/conversation/session.types.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
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
    startedAt: '2026-04-30T10:00:00.000Z',
    lastActivityAt: '2026-04-30T10:05:00.000Z',
    ...overrides,
  }
}

function makeEvent(event: StoredEvent): StoredEvent {
  return event
}

function makeApp(params?: { sessions?: Session[]; events?: StoredEvent[] }): FastifyInstance {
  const eventLogRepository = new InMemoryEventLogRepository()
  for (const event of params?.events ?? []) {
    void eventLogRepository.append(event)
  }

  const app = createServer(testConfig, {
    sessionRepository: new InMemorySessionRepository(params?.sessions ?? [makeSession()]),
    eventLogRepository,
  })
  appsToClose.push(app)
  return app
}

describe('GET /v1/admin/sessions/:sessionId/metrics — auth', () => {
  it('returns 401 without API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/metrics',
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 with wrong API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/metrics',
      headers: authHeaders('wrong-key'),
    })
    expect(response.statusCode).toBe(401)
  })
})

describe('GET /v1/admin/sessions/:sessionId/metrics — not found', () => {
  it('returns 404 when session does not exist', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_missing/metrics',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('GET /v1/admin/sessions/:sessionId/metrics — success', () => {
  it('returns a metrics report with summary and turns', async () => {
    const response = await makeApp({
      events: [
        makeEvent({
          sessionId: 'session_1',
          type: 'turn_completed',
          severity: 'info',
          correlationId: 'corr_1',
          payload: {
            correlationId: 'corr_1',
            conversationId: 'conversation_1',
            turnIndex: 1,
            avatarId: 'avatar_1',
            avatarLatencyMs: 120,
            totalTurnLatencyMs: 180,
            inputTokens: 20,
            outputTokens: 30,
            totalTokens: 50,
            model: 'null-model',
            hasGm: true,
          },
        }),
        makeEvent({
          sessionId: 'session_1',
          type: 'gm_triggered',
          severity: 'info',
          correlationId: 'corr_1',
          payload: {
            triggerReason: 'post_turn_observation',
            turnIndex: 1,
            interactionCount: 1,
            stateBefore: { progression: 'intro', topicsCovered: [] },
            latencyMs: 45,
            inputTokens: 8,
            outputTokens: 9,
          },
        }),
      ],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/metrics',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<
      ApiResponse<{
        sessionId: string
        summary: { totalTurns: number; turnsWithGm: number; avgGmLatencyMs: number | null }
        turns: Array<{ turnIndex: number; hasGm: boolean; gmLatencyMs?: number }>
      }>
    >()
    expect(body.error).toBeNull()
    expect(body.data?.sessionId).toBe('session_1')
    expect(body.data?.summary).toMatchObject({
      totalTurns: 1,
      turnsWithGm: 1,
      avgGmLatencyMs: 45,
    })
    expect(body.data?.turns).toEqual([
      expect.objectContaining({
        turnIndex: 1,
        hasGm: true,
        gmLatencyMs: 45,
      }),
    ])
  })
})
