import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
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
