import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiResponse, RuntimeEvent } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type {
  ISessionEventPublisher,
  SessionEventHandler,
} from '../../application/ports/ISessionEventPublisher.js'
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

function makePublisher(overrides: Partial<ISessionEventPublisher> = {}): ISessionEventPublisher {
  return {
    emit: () => undefined,
    subscribe: () => () => undefined,
    getLastEvent: () => undefined,
    isProcessing: () => false,
    setProcessing: () => undefined,
    ...overrides,
  }
}

function makeApp(params?: {
  sessions?: Session[]
  publisher?: ISessionEventPublisher
}): FastifyInstance {
  const app = createServer(testConfig, {
    sessionRepository: new InMemorySessionRepository(params?.sessions ?? []),
    ...(params?.publisher !== undefined ? { sessionEventPublisher: params.publisher } : {}),
  })
  appsToClose.push(app)
  return app
}

describe('GET /v1/sessions/:sessionId/events/stream auth and not found', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const app = makeApp({ sessions: [makeSession()] })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/events/stream',
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const app = makeApp({ sessions: [makeSession()] })

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
    const app = makeApp()

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
    const app = makeApp({ sessions: [makeSession()] })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/events/stream',
      headers: authHeaders(),
      payloadAsStream: true,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')
    expect(response.headers['access-control-allow-origin']).toBe('*')

    const stream = response.stream()
    const chunk = await new Promise<string>((resolve) => {
      stream.once('data', (data: Buffer) => {
        resolve(data.toString())
      })
    })

    expect(chunk).toContain(': keepalive')
    stream.destroy()
  })

  it('writes event frame to stream when publisher emits an event', async () => {
    let capturedHandler: SessionEventHandler | undefined
    const publisher = makePublisher({
      subscribe: (_sessionId, handler) => {
        capturedHandler = handler
        return () => undefined
      },
    })
    const app = makeApp({ sessions: [makeSession()], publisher })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/events/stream',
      headers: authHeaders(),
      payloadAsStream: true,
    })

    expect(response.statusCode).toBe(200)
    const stream = response.stream()

    const chunks: string[] = []
    stream.on('data', (data: Buffer) => {
      chunks.push(data.toString())
    })

    // Wait for keepalive to confirm connection is live
    await vi.waitFor(() => {
      expect(chunks.join('')).toContain(': keepalive')
    })

    const event: RuntimeEvent = {
      eventId: 'evt_test_1',
      sessionId: 'session_1',
      type: 'runtime.avatar_unlocked',
      occurredAt: '2026-05-05T10:00:00.000Z',
      payload: { unlockedAvatarIds: ['avatar_2'] },
    }
    capturedHandler?.(event)

    await vi.waitFor(() => {
      const all = chunks.join('')
      expect(all).toContain('event: runtime_event')
      expect(all).toContain('"eventId":"evt_test_1"')
    })

    stream.destroy()
  })

  it('removes subscriber when client disconnects', async () => {
    let unsubscribeCalled = false
    const publisher = makePublisher({
      subscribe: () => () => {
        unsubscribeCalled = true
      },
    })
    const app = makeApp({ sessions: [makeSession()], publisher })
    await app.listen({ port: 0, host: '127.0.0.1' })

    try {
      const { port } = app.server.address() as AddressInfo

      await new Promise<void>((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/v1/sessions/session_1/events/stream',
          headers: { 'x-api-key': 'test-secret' },
        })
        req.end()
        req.once('response', (res) => {
          res.once('data', () => {
            req.socket?.destroy()
            resolve()
          })
          res.once('error', reject)
        })
        req.once('error', reject)
      })

      await vi.waitFor(() => {
        expect(unsubscribeCalled).toBe(true)
      })
    } finally {
      await app.close()
    }
  })
})
