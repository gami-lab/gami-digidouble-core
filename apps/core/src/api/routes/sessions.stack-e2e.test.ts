import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

function registerApp(app: FastifyInstance): FastifyInstance {
  appsToClose.push(app)
  return app
}

function makeApp(params?: {
  scenarios?: ConstructorParameters<typeof InMemoryScenarioRepository>[0]
  avatars?: ConstructorParameters<typeof InMemoryAvatarRepository>[0]
  sessions?: ConstructorParameters<typeof InMemorySessionRepository>[0]
}): FastifyInstance {
  return createServer(TEST_CONFIG, {
    scenarioRepository: new InMemoryScenarioRepository(params?.scenarios ?? []),
    avatarRepository: new InMemoryAvatarRepository(params?.avatars ?? []),
    sessionRepository: new InMemorySessionRepository(params?.sessions ?? []),
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

async function seedSwitchScenario(app: FastifyInstance): Promise<{
  sessionId: string
  avatar1Id: string
  avatar2Id: string
  previousConversationId: string
}> {
  const seeded = await seedSessionWithAvatars(app)

  const startConversation = await app.inject({
    method: 'POST',
    url: `/v1/sessions/${seeded.sessionId}/conversations`,
    headers: authHeaders(),
    payload: { avatarId: seeded.avatar1Id },
  })
  expect(startConversation.statusCode).toBe(201)
  const conversationBody =
    startConversation.json<ApiResponse<{ conversation: { conversationId: string } }>>()
  const previousConversationId = requireId(conversationBody.data?.conversation, 'conversationId')

  return {
    sessionId: seeded.sessionId,
    avatar1Id: seeded.avatar1Id,
    avatar2Id: seeded.avatar2Id,
    previousConversationId,
  }
}

async function seedSessionWithAvatars(app: FastifyInstance): Promise<{
  sessionId: string
  avatar1Id: string
  avatar2Id: string
}> {
  const createScenario = await app.inject({
    method: 'POST',
    url: '/v1/scenarios',
    headers: authHeaders(),
    payload: { name: `Switch Scenario ${String(Date.now())}` },
  })
  expect(createScenario.statusCode).toBe(201)
  const scenarioBody = createScenario.json<ApiResponse<{ scenario: { scenarioId: string } }>>()
  const scenarioId = requireId(scenarioBody.data?.scenario, 'scenarioId')

  const createAvatar1 = await app.inject({
    method: 'POST',
    url: `/v1/scenarios/${scenarioId}/avatars`,
    headers: authHeaders(),
    payload: { name: 'Avatar One', personaPrompt: 'You are avatar one.' },
  })
  expect(createAvatar1.statusCode).toBe(201)
  const avatar1Body = createAvatar1.json<ApiResponse<{ avatar: { avatarId: string } }>>()
  const avatar1Id = requireId(avatar1Body.data?.avatar, 'avatarId')

  const createAvatar2 = await app.inject({
    method: 'POST',
    url: `/v1/scenarios/${scenarioId}/avatars`,
    headers: authHeaders(),
    payload: { name: 'Avatar Two', personaPrompt: 'You are avatar two.' },
  })
  expect(createAvatar2.statusCode).toBe(201)
  const avatar2Body = createAvatar2.json<ApiResponse<{ avatar: { avatarId: string } }>>()
  const avatar2Id = requireId(avatar2Body.data?.avatar, 'avatarId')

  const createSession = await app.inject({
    method: 'POST',
    url: '/v1/sessions',
    headers: authHeaders(),
    payload: { userId: `user_${String(Date.now())}`, scenarioId },
  })
  expect(createSession.statusCode).toBe(201)
  const sessionBody = createSession.json<ApiResponse<{ session: { sessionId: string } }>>()
  const sessionId = requireId(sessionBody.data?.session, 'sessionId')
  return { sessionId, avatar1Id, avatar2Id }
}

describe('GET /:sessionId/available-avatars auth', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/available-avatars',
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/available-avatars',
      headers: authHeaders('wrong-key'),
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /:sessionId/available-avatars behavior', () => {
  it('returns 404 NOT_FOUND when sessionId does not exist', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_unknown/available-avatars',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns available avatars and currentAvatarId', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedSessionWithAvatars(app)

    const startConversation = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/conversations`,
      headers: authHeaders(),
      payload: { avatarId: seeded.avatar1Id },
    })
    expect(startConversation.statusCode).toBe(201)

    const response = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${seeded.sessionId}/available-avatars`,
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<
      ApiResponse<{
        sessionId: string
        currentAvatarId: string | null
        avatars: Array<{ avatarId: string }>
      }>
    >()
    expect(body.error).toBeNull()
    expect(body.data?.sessionId).toBe(seeded.sessionId)
    expect(body.data?.currentAvatarId).toBe(seeded.avatar1Id)
    const avatarIds = body.data?.avatars.map((avatar) => avatar.avatarId) ?? []
    expect(avatarIds).toContain(seeded.avatar1Id)
    expect(avatarIds).toContain(seeded.avatar2Id)
  })
})

describe('GET /:sessionId/avatar-transitions auth', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/avatar-transitions',
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_1/avatar-transitions',
      headers: authHeaders('wrong-key'),
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /:sessionId/avatar-transitions behavior', () => {
  it('returns 404 NOT_FOUND when sessionId does not exist', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/session_unknown/avatar-transitions',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns [] when session has no conversations', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedSessionWithAvatars(app)

    const response = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${seeded.sessionId}/avatar-transitions`,
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ transitions: unknown[] }>>()
    expect(body.error).toBeNull()
    expect(body.data?.transitions).toEqual([])
  })

  it('returns session_start and manual_switch after switch-avatar', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedSwitchScenario(app)

    const switchAvatar = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/switch-avatar`,
      headers: authHeaders(),
      payload: { avatarId: seeded.avatar2Id },
    })
    expect(switchAvatar.statusCode).toBe(200)
    const switchBody = switchAvatar.json<
      ApiResponse<{
        conversation: { conversationId: string }
      }>
    >()
    const switchedConversationId = requireId(switchBody.data?.conversation, 'conversationId')

    const response = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${seeded.sessionId}/avatar-transitions`,
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<
      ApiResponse<{
        transitions: Array<{
          toConversationId: string
          toAvatarId: string
          fromConversationId: string | null
          fromAvatarId: string | null
          reason: string | null
        }>
      }>
    >()
    expect(body.error).toBeNull()
    expect(body.data?.transitions).toHaveLength(2)
    expect(body.data?.transitions[0]).toMatchObject({
      toConversationId: seeded.previousConversationId,
      toAvatarId: seeded.avatar1Id,
      fromConversationId: null,
      fromAvatarId: null,
      reason: 'session_start',
      startedBy: 'user',
    })
    expect(body.data?.transitions[1]).toMatchObject({
      toConversationId: switchedConversationId,
      toAvatarId: seeded.avatar2Id,
      fromConversationId: seeded.previousConversationId,
      fromAvatarId: seeded.avatar1Id,
      reason: 'manual_switch',
      startedBy: 'user',
    })
  })
})

describe('POST /:sessionId/switch-avatar auth', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/session_1/switch-avatar',
      payload: { avatarId: 'avatar_1' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/session_1/switch-avatar',
      headers: authHeaders('wrong-key'),
      payload: { avatarId: 'avatar_1' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('POST /:sessionId/switch-avatar validation and conflicts', () => {
  it('returns 400 VALIDATION_ERROR when avatarId is missing', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/session_1/switch-avatar',
      headers: authHeaders(),
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR when reason exceeds max length 200', async () => {
    const app = registerApp(makeApp())
    const seeded = await seedSwitchScenario(app)

    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seeded.sessionId}/switch-avatar`,
      headers: authHeaders(),
      payload: { avatarId: seeded.avatar2Id, reason: 'r'.repeat(201) },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 NOT_FOUND when sessionId does not exist', async () => {
    const app = registerApp(makeApp())

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/session_unknown/switch-avatar',
      headers: authHeaders(),
      payload: { avatarId: 'avatar_1' },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns 409 CONFLICT when session is not active', async () => {
    const app = registerApp(
      makeApp({
        sessions: [
          {
            sessionId: 'session_1',
            userId: 'user_1',
            scenarioId: 'scenario_1',
            activeAvatarId: 'avatar_1',
            status: 'closed',
            startedAt: '2026-04-18T10:00:00.000Z',
            lastActivityAt: '2026-04-18T10:30:00.000Z',
            endedAt: '2026-04-18T10:30:00.000Z',
          },
        ],
        avatars: [
          {
            avatarId: 'avatar_1',
            scenarioId: 'scenario_1',
            name: 'Ava',
            status: 'active',
            personaPrompt: 'You are Ava.',
            config: {},
            createdAt: '2026-04-18T10:00:00.000Z',
            updatedAt: '2026-04-18T10:00:00.000Z',
          },
        ],
      }),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/session_1/switch-avatar',
      headers: authHeaders(),
      payload: { avatarId: 'avatar_1' },
    })

    expect(response.statusCode).toBe(409)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('CONFLICT')
  })
})

describe('POST /:sessionId/switch-avatar success', () => {
  it('returns 200 and creates a handoff conversation on valid manual switch', async () => {
    const app = registerApp(makeApp())
    const seed = await seedSwitchScenario(app)

    const switchAvatar = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${seed.sessionId}/switch-avatar`,
      headers: authHeaders(),
      payload: { avatarId: seed.avatar2Id },
    })

    expect(switchAvatar.statusCode).toBe(200)
    const body = switchAvatar.json<
      ApiResponse<{
        session: { sessionId: string; activeAvatarId?: string }
        conversation: { conversationId: string; avatarId: string }
        previousConversationId: string | null
      }>
    >()
    expect(body.error).toBeNull()
    expect(body.data?.session.sessionId).toBe(seed.sessionId)
    expect(body.data?.session.activeAvatarId).toBe(seed.avatar2Id)
    expect(body.data?.conversation.conversationId.startsWith('conversation_')).toBe(true)
    expect(body.data?.conversation.avatarId).toBe(seed.avatar2Id)
    expect(body.data?.previousConversationId).toBe(seed.previousConversationId)
  })
})
