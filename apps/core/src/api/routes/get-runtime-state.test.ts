import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { ISessionEventPublisher } from '../../application/ports/ISessionEventPublisher.js'
import type { Config } from '../../config.js'
import type { Conversation, Session } from '../../domain/conversation/session.types.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
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

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-05-05T10:01:00.000Z',
    lastActivityAt: '2026-05-05T10:01:00.000Z',
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
  conversations?: Conversation[]
  publisher?: ISessionEventPublisher
}): FastifyInstance {
  const app = createServer(testConfig, {
    sessionRepository: new InMemorySessionRepository(params?.sessions ?? []),
    conversationRepository: new InMemoryConversationRepository(params?.conversations ?? []),
    ...(params?.publisher !== undefined ? { sessionEventPublisher: params.publisher } : {}),
  })
  appsToClose.push(app)
  return app
}

describe('GET /v1/sessions/:sessionId/runtime-state auth and errors', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const app = makeApp()

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/runtime-state',
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const app = makeApp()

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/runtime-state',
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
      url: '/v1/sessions/session_unknown/runtime-state',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('GET /v1/sessions/:sessionId/runtime-state success', () => {
  it('returns 200 with runtime state on happy path', async () => {
    const app = makeApp({
      sessions: [makeSession()],
      conversations: [makeConversation()],
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/runtime-state',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<
      ApiResponse<{
        runtimeState: {
          sessionId: string
          canSendMessage: boolean
          isProcessing: boolean
          updatedAt: string
        }
      }>
    >()

    expect(body.error).toBeNull()
    expect(body.data?.runtimeState.sessionId).toBe('session_1')
    expect(body.data?.runtimeState.canSendMessage).toBe(true)
    expect(body.data?.runtimeState.isProcessing).toBe(false)
    expect(typeof body.data?.runtimeState.updatedAt).toBe('string')
  })

  it('returns isProcessing=true when publisher reports active processing', async () => {
    const app = makeApp({
      sessions: [makeSession()],
      conversations: [makeConversation()],
      publisher: makePublisher({ isProcessing: (sessionId) => sessionId === 'session_1' }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/runtime-state',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ runtimeState: { isProcessing: boolean } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.runtimeState.isProcessing).toBe(true)
  })
})
