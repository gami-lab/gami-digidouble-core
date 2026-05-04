import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../../config.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
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

function registerApp(app: FastifyInstance): FastifyInstance {
  appsToClose.push(app)
  return app
}

function makeApp(): FastifyInstance {
  return createServer(testConfig, {
    scenarioRepository: new InMemoryScenarioRepository(),
    avatarRepository: new InMemoryAvatarRepository(),
    sessionRepository: new InMemorySessionRepository(),
    conversationRepository: new InMemoryConversationRepository(),
    messageRepository: new InMemoryMessageRepository(),
  })
}

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

function requireId<T extends Record<string, unknown>>(value: T | undefined, key: keyof T): string {
  const id = value?.[key]
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Missing required id: ${String(key)}`)
  }
  return id
}

async function seedActiveConversation(app: FastifyInstance): Promise<{
  sessionId: string
  conversationId: string
}> {
  const createScenario = await app.inject({
    method: 'POST',
    url: '/v1/scenarios',
    headers: authHeaders(),
    payload: { name: `End Scenario ${String(Date.now())}` },
  })
  const scenarioId = requireId(
    createScenario.json<ApiResponse<{ scenario: { scenarioId: string } }>>().data?.scenario,
    'scenarioId',
  )

  const createAvatar1 = await app.inject({
    method: 'POST',
    url: `/v1/scenarios/${scenarioId}/avatars`,
    headers: authHeaders(),
    payload: { name: 'Avatar One', personaPrompt: 'You are avatar one.' },
  })
  const avatar1Id = requireId(
    createAvatar1.json<ApiResponse<{ avatar: { avatarId: string } }>>().data?.avatar,
    'avatarId',
  )

  const createSession = await app.inject({
    method: 'POST',
    url: '/v1/sessions',
    headers: authHeaders(),
    payload: { userId: `user_${String(Date.now())}`, scenarioId },
  })
  const sessionId = requireId(
    createSession.json<ApiResponse<{ session: { sessionId: string } }>>().data?.session,
    'sessionId',
  )

  const startConversation = await app.inject({
    method: 'POST',
    url: `/v1/sessions/${sessionId}/conversations`,
    headers: authHeaders(),
    payload: { avatarId: avatar1Id },
  })
  const conversationId = requireId(
    startConversation.json<ApiResponse<{ conversation: { conversationId: string } }>>().data
      ?.conversation,
    'conversationId',
  )

  return { sessionId, conversationId }
}

describe('POST /:sessionId/conversations/:conversationId/end auth', () => {
  it('returns 401 when API key is missing', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedActiveConversation(app)

    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/conversations/${seeded.conversationId}/end`,
      payload: {},
    })

    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when API key is wrong', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedActiveConversation(app)

    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/conversations/${seeded.conversationId}/end`,
      headers: authHeaders('wrong-key'),
      payload: {},
    })

    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })
})

describe('POST /:sessionId/conversations/:conversationId/end behavior', () => {
  it('returns 400 for unsupported reason', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedActiveConversation(app)

    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/conversations/${seeded.conversationId}/end`,
      headers: authHeaders(),
      payload: { reason: 'manual_switch' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when session is missing', async () => {
    const app = registerApp(makeApp())
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/session_unknown/conversations/conversation_1/end',
      headers: authHeaders(),
      payload: {},
    })

    expect(response.statusCode).toBe(404)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })

  it('returns 404 when conversation is missing in session', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedActiveConversation(app)
    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/conversations/conversation_unknown/end`,
      headers: authHeaders(),
      payload: {},
    })

    expect(response.statusCode).toBe(404)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })

  it('returns 409 when conversation is already closed', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedActiveConversation(app)

    const first = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/conversations/${seeded.conversationId}/end`,
      headers: authHeaders(),
      payload: { reason: 'operator_end' },
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/conversations/${seeded.conversationId}/end`,
      headers: authHeaders(),
      payload: { reason: 'operator_end' },
    })
    expect(second.statusCode).toBe(409)
    expect(second.json<ApiResponse<null>>().error?.code).toBe('CONFLICT')
  })

  it('returns 200 and persists closed conversation state', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedActiveConversation(app)

    const closeResponse = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/conversations/${seeded.conversationId}/end`,
      headers: authHeaders(),
      payload: { reason: 'user_end' },
    })

    expect(closeResponse.statusCode).toBe(200)
    const closeBody = closeResponse.json<
      ApiResponse<{
        conversation: { conversationId: string; status: string; endedAt?: string }
        compaction: { scheduled: true }
      }>
    >()
    expect(closeBody.error).toBeNull()
    expect(closeBody.data?.conversation.conversationId).toBe(seeded.conversationId)
    expect(closeBody.data?.conversation.status).toBe('closed')
    expect(closeBody.data?.conversation.endedAt).toBeTypeOf('string')
    expect(closeBody.data?.compaction.scheduled).toBe(true)
  })
})
