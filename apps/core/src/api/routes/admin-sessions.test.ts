import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../../config.js'
import type { Conversation, Session } from '../../domain/conversation/session.types.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryGmStateRepository } from '../../infrastructure/db/in-memory-gm-state.repository.js'
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

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_2',
    unlockedAvatarIds: ['avatar_1', 'avatar_2'],
    gmNotes: 'Nudge toward the ethics specialist.',
    status: 'active',
    startedAt: '2026-04-28T10:00:00.000Z',
    lastActivityAt: '2026-04-28T10:05:00.000Z',
    ...overrides,
  }
}

function makeConversation(overrides: Partial<Conversation>): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'closed',
    startedAt: '2026-04-28T10:00:00.000Z',
    lastActivityAt: '2026-04-28T10:01:00.000Z',
    ...overrides,
  }
}

function makeApp(params?: {
  sessions?: Session[]
  conversations?: Conversation[]
}): FastifyInstance {
  const app = createServer(testConfig, {
    sessionRepository: new InMemorySessionRepository(params?.sessions ?? [makeSession()]),
    gmStateRepository: new InMemoryGmStateRepository([
      {
        sessionId: 'session_1',
        state: {
          currentAvatarId: 'avatar_2',
          progression: 'intro complete',
          topicsCovered: ['setup'],
          interactionCount: 4,
        },
      },
    ]),
    conversationRepository: new InMemoryConversationRepository(
      params?.conversations ?? [
        makeConversation({
          conversationId: 'conversation_2',
          avatarId: 'avatar_2',
          startedBy: 'gm',
          reason: 'turn_threshold',
          startedAt: '2026-04-28T10:04:00.000Z',
        }),
        makeConversation({
          conversationId: 'conversation_1',
          avatarId: 'avatar_1',
          startedBy: 'user',
          reason: 'session_start',
          startedAt: '2026-04-28T10:00:00.000Z',
        }),
      ],
    ),
  })
  appsToClose.push(app)
  return app
}

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

describe('GET /v1/admin/sessions/:sessionId/inspect', () => {
  it('requires a valid API key', async () => {
    const app = makeApp()

    const missing = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/inspect',
    })
    const wrong = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/inspect',
      headers: authHeaders('wrong-key'),
    })

    expect(missing.statusCode).toBe(401)
    expect(wrong.statusCode).toBe(401)
    expect(missing.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
    expect(wrong.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 NOT_FOUND for an unknown session', async () => {
    const app = makeApp({ sessions: [] })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_missing/inspect',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })

  it('returns the inspect snapshot without message or prompt content', async () => {
    const app = makeApp()

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/inspect',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<
      ApiResponse<{
        inspect: {
          gmState: unknown
          gmNotes: string | null
          unlockedAvatarIds: string[]
          transitionHistory: unknown[]
        }
      }>
    >()
    expect(body.error).toBeNull()
    expect(body.data?.inspect.gmState).toEqual({
      currentAvatarId: 'avatar_2',
      progression: 'intro complete',
      topicsCovered: ['setup'],
      interactionCount: 4,
    })
    expect(body.data?.inspect.unlockedAvatarIds).toEqual(['avatar_1', 'avatar_2'])
    expect(body.data?.inspect.gmNotes).toBe('Nudge toward the ethics specialist.')
    expect(body.data?.inspect.transitionHistory).toEqual([
      {
        fromAvatarId: 'avatar_1',
        toAvatarId: 'avatar_2',
        reason: 'turn_threshold',
        startedBy: 'gm',
        transitionedAt: '2026-04-28T10:04:00.000Z',
      },
      {
        fromAvatarId: null,
        toAvatarId: 'avatar_1',
        reason: 'session_start',
        startedBy: 'user',
        transitionedAt: '2026-04-28T10:00:00.000Z',
      },
    ])
    expect(response.body).not.toContain('secret user input')
    expect(response.body).not.toContain('personaPrompt')
    expect(response.body).not.toContain('You are')
  })
})
