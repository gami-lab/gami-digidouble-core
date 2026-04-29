import { describe, expect, it } from 'vitest'
import type { ApiResponse, AvatarSummary } from '@gami/shared'
import type { Config } from '../../config.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { Session } from '../../domain/conversation/session.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
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

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava.',
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

function makeApp(
  { avatars = [], sessions = [] }: { avatars?: AvatarConfig[]; sessions?: Session[] } = {
    avatars: [],
    sessions: [],
  },
) {
  return createServer(testConfig, {
    avatarRepository: new InMemoryAvatarRepository(avatars),
    sessionRepository: new InMemorySessionRepository(sessions),
  })
}

describe('DELETE /v1/avatars/:avatarId', () => {
  it('deletes avatar when safe', async () => {
    const app = makeApp({
      avatars: [makeAvatar({ avatarId: 'avatar_1', scenarioId: 'scenario_1' })],
      sessions: [makeSession({ scenarioId: 'scenario_1', status: 'closed' })],
    })

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/avatars/avatar_1',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ avatarId: string; deleted: true }>>()
    expect(body.error).toBeNull()
    expect(body.data).toEqual({ avatarId: 'avatar_1', deleted: true })
  })

  it('returns 404 when avatar does not exist', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: '/v1/avatars/avatar_missing',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns 409 when scenario has active sessions', async () => {
    const response = await makeApp({
      avatars: [makeAvatar({ avatarId: 'avatar_1', scenarioId: 'scenario_1' })],
      sessions: [makeSession({ scenarioId: 'scenario_1', status: 'active' })],
    }).inject({
      method: 'DELETE',
      url: '/v1/avatars/avatar_1',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(409)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('CONFLICT')
  })
})

describe('PATCH /v1/avatars/:avatarId', () => {
  it('updates avatar and returns updated fields', async () => {
    const app = makeApp({
      avatars: [
        makeAvatar({
          avatarId: 'avatar_1',
          personaPrompt: 'You are Ava.',
          config: { routeKey: 'guide' },
        }),
      ],
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/avatars/avatar_1',
      headers: { 'x-api-key': 'test-secret', 'content-type': 'application/json' },
      payload: { personaPrompt: 'Updated prompt', tone: 'formal' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<
      ApiResponse<{
        avatar: { personaPrompt: string; tone: string; config: Record<string, unknown> }
      }>
    >()
    expect(body.error).toBeNull()
    expect(body.data?.avatar.personaPrompt).toBe('Updated prompt')
    expect(body.data?.avatar.tone).toBe('formal')
    expect(body.data?.avatar.config).toEqual({ routeKey: 'guide' })
  })

  it('returns 404 when avatar does not exist', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: '/v1/avatars/avatar_missing',
      headers: { 'x-api-key': 'test-secret', 'content-type': 'application/json' },
      payload: { name: 'New name' },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns 400 when body is empty', async () => {
    const response = await makeApp({
      avatars: [makeAvatar({ avatarId: 'avatar_1' })],
    }).inject({
      method: 'PATCH',
      url: '/v1/avatars/avatar_1',
      headers: { 'x-api-key': 'test-secret', 'content-type': 'application/json' },
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 when no API key provided', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: '/v1/avatars/avatar_1',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'x' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('sets and returns availabilityKey when provided', async () => {
    const app = makeApp({
      avatars: [makeAvatar({ avatarId: 'avatar_1' })],
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/avatars/avatar_1',
      headers: { 'x-api-key': 'test-secret', 'content-type': 'application/json' },
      payload: { availabilityKey: 'guide' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ avatar: { availabilityKey?: string } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.avatar.availabilityKey).toBe('guide')
  })

  it('response includes all AvatarSummary contract fields', async () => {
    const app = makeApp({
      avatars: [makeAvatar({ avatarId: 'avatar_1', availabilityKey: 'guide' })],
    })
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/avatars/avatar_1',
      headers: { 'x-api-key': 'test-secret', 'content-type': 'application/json' },
      payload: { name: 'Ava Updated' },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ avatar: AvatarSummary }>>()
    const avatar = body.data?.avatar
    expect(avatar?.avatarId).toBe('avatar_1')
    expect(avatar?.scenarioId).toBe('scenario_1')
    expect(avatar?.name).toBe('Ava Updated')
    expect(avatar?.status).toBe('active')
    expect(avatar?.availabilityKey).toBe('guide')
    expect(avatar?.config).toBeDefined()
    expect(avatar?.createdAt).toBeDefined()
    expect(avatar?.updatedAt).toBeDefined()
  })
})
