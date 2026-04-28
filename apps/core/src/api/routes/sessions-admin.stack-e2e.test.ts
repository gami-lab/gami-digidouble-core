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
    scenarioRepository: new InMemoryScenarioRepository([]),
    avatarRepository: new InMemoryAvatarRepository([]),
    sessionRepository: new InMemorySessionRepository([]),
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

async function seedSessionWithAvatar(app: FastifyInstance): Promise<{
  sessionId: string
  avatarId: string
}> {
  const createScenario = await app.inject({
    method: 'POST',
    url: '/v1/scenarios',
    headers: authHeaders(),
    payload: { name: `Scenario ${String(Date.now())}` },
  })
  expect(createScenario.statusCode).toBe(201)
  const scenarioId = requireId(
    createScenario.json<ApiResponse<{ scenario: { scenarioId: string } }>>().data?.scenario,
    'scenarioId',
  )

  const createAvatar = await app.inject({
    method: 'POST',
    url: `/v1/scenarios/${scenarioId}/avatars`,
    headers: authHeaders(),
    payload: { name: 'Avatar', personaPrompt: 'You are an avatar.' },
  })
  expect(createAvatar.statusCode).toBe(201)
  const avatarId = requireId(
    createAvatar.json<ApiResponse<{ avatar: { avatarId: string } }>>().data?.avatar,
    'avatarId',
  )

  const createSession = await app.inject({
    method: 'POST',
    url: '/v1/sessions',
    headers: authHeaders(),
    payload: { userId: `user_${String(Date.now())}`, scenarioId },
  })
  expect(createSession.statusCode).toBe(201)
  const sessionId = requireId(
    createSession.json<ApiResponse<{ session: { sessionId: string } }>>().data?.session,
    'sessionId',
  )

  return { sessionId, avatarId }
}

describe('GET /v1/sessions auth', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const app = registerApp(makeApp())
    const response = await app.inject({ method: 'GET', url: '/v1/sessions' })
    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const app = registerApp(makeApp())
    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions',
      headers: authHeaders('wrong-key'),
    })
    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /v1/sessions behavior', () => {
  it('returns 200 with empty sessions array when no sessions exist', async () => {
    const app = registerApp(makeApp())
    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ sessions: unknown[] }>>()
    expect(body.error).toBeNull()
    expect(Array.isArray(body.data?.sessions)).toBe(true)
    expect(body.data?.sessions).toHaveLength(0)
  })

  it('returns 400 when status filter value is invalid', async () => {
    const app = registerApp(makeApp())
    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions?status=invalid',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(400)
  })
})

describe('POST /v1/sessions/:sessionId/reset auth', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const app = registerApp(makeApp())
    const response = await app.inject({ method: 'POST', url: '/v1/sessions/session_1/reset' })
    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const app = registerApp(makeApp())
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/session_1/reset',
      headers: authHeaders('wrong-key'),
    })
    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })
})

describe('POST /v1/sessions/:sessionId/reset behavior', () => {
  it('returns 404 NOT_FOUND for a nonexistent session', async () => {
    const app = registerApp(makeApp())
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/nonexistent/reset',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(404)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })

  it('returns 200 and clears conversations on happy-path reset', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedSessionWithAvatar(app)

    const startConv = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/conversations`,
      headers: authHeaders(),
      payload: { avatarId: seeded.avatarId },
    })
    expect(startConv.statusCode).toBe(201)

    const reset = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/reset`,
      headers: authHeaders(),
    })
    expect(reset.statusCode).toBe(200)
    const resetBody =
      reset.json<
        ApiResponse<{ session: { sessionId: string; status: string; activeAvatarId?: string } }>
      >()
    expect(resetBody.error).toBeNull()
    expect(resetBody.data?.session.sessionId).toBe(seeded.sessionId)
    expect(resetBody.data?.session.status).toBe('active')
    expect(resetBody.data?.session.activeAvatarId).toBeUndefined()

    const convList = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${seeded.sessionId}/conversations`,
      headers: authHeaders(),
    })
    expect(convList.statusCode).toBe(200)
    expect(
      convList.json<ApiResponse<{ conversations: unknown[] }>>().data?.conversations,
    ).toHaveLength(0)
  })
})
