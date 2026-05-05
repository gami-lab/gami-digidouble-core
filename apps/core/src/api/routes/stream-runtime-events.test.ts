import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../../config.js'
import type { Session } from '../../domain/conversation/session.types.js'
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
    activeAvatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-05-05T10:00:00.000Z',
    lastActivityAt: '2026-05-05T10:00:00.000Z',
    ...overrides,
  }
}

function makeApp(sessions: Session[] = []): FastifyInstance {
  const app = createServer(testConfig, {
    sessionRepository: new InMemorySessionRepository(sessions),
  })
  appsToClose.push(app)
  return app
}

describe('GET /v1/sessions/:sessionId/events/stream auth and not found', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const app = makeApp([makeSession()])

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/events/stream',
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const app = makeApp([makeSession()])

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/events/stream',
      headers: authHeaders('wrong-key'),
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 NOT_FOUND for unknown sessionId', async () => {
    const app = makeApp([])

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_unknown/events/stream',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('GET /v1/sessions/:sessionId/events/stream sse headers', () => {
  it('returns event-stream headers and initial keepalive frame', async () => {
    const app = makeApp([makeSession()])

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/events/stream',
      headers: authHeaders(),
      payloadAsStream: true,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')

    const stream = response.stream()
    const chunk = await new Promise<string>((resolve) => {
      stream.once('data', (data: Buffer) => {
        resolve(data.toString())
      })
    })

    expect(chunk).toContain(': keepalive')
    stream.destroy()
  })
})
