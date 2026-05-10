import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse, AdminSessionContextResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../../config.js'
import { createServer } from '../server.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryGmStateRepository } from '../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemoryUserRepository } from '../../infrastructure/db/in-memory-user.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { InMemorySessionMemoryRepository } from '../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemoryAvatarSessionMemoryRepository } from '../../infrastructure/db/in-memory-avatar-session-memory.repository.js'

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

function makeApp(): FastifyInstance {
  const app = createServer(testConfig, buildAdapters())
  appsToClose.push(app)
  return app
}

function buildAdapters() {
  return {
    sessionRepository: new InMemorySessionRepository([makeSession()]),
    conversationRepository: new InMemoryConversationRepository([makeConversation()]),
    avatarRepository: new InMemoryAvatarRepository([makeAvatar()]),
    scenarioRepository: new InMemoryScenarioRepository([makeScenario()]),
    messageRepository: new InMemoryMessageRepository(makeMessages()),
    gmStateRepository: new InMemoryGmStateRepository([makeGmState()]),
    userRepository: new InMemoryUserRepository([makeUser()]),
    userMemoryFactRepository: new InMemoryUserMemoryFactRepository([makeFact()]),
    sessionMemoryRepository: new InMemorySessionMemoryRepository([makeSessionMemory()]),
    avatarSessionMemoryRepository: new InMemoryAvatarSessionMemoryRepository([makeAvatarMemory()]),
  }
}

function makeSession() {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    unlockedAvatarIds: ['avatar_1'],
    gmNotes: 'Follow up with concrete examples.',
    status: 'active' as const,
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:10:00.000Z',
  }
}

function makeConversation() {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active' as const,
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:10:00.000Z',
  }
}

function makeAvatar() {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Guide',
    status: 'active' as const,
    personaPrompt: 'You are Guide.',
    description: 'General',
    config: {},
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }
}

function makeScenario() {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active' as const,
    config: { worldContext: 'World', objectives: ['Obj'] },
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }
}

function makeMessages() {
  return [
    {
      messageId: 'msg_1',
      conversationId: 'conversation_1',
      role: 'user' as const,
      content: 'hello',
      createdAt: '2026-05-01T10:01:00.000Z',
    },
    {
      messageId: 'msg_2',
      conversationId: 'conversation_1',
      role: 'avatar' as const,
      content: 'hi',
      createdAt: '2026-05-01T10:01:01.000Z',
    },
  ]
}

function makeGmState() {
  return {
    sessionId: 'session_1',
    state: {
      currentAvatarId: 'avatar_1',
      progression: 'intro',
      topicsCovered: ['setup'],
      interactionCount: 2,
    },
  }
}

function makeUser() {
  return {
    userId: 'user_1',
    persona: { name: 'Maya', roleInWorld: 'student' },
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }
}

function makeFact() {
  return {
    id: 'umf_1',
    userId: 'user_1',
    category: 'preference',
    key: 'style',
    value: 'concise',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }
}

function makeSessionMemory() {
  return {
    sessionId: 'session_1',
    summary: 'Session summary',
    updatedAt: '2026-05-01T10:09:00.000Z',
  }
}

function makeAvatarMemory() {
  return {
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    summary: 'Avatar summary',
    updatedAt: '2026-05-01T10:08:00.000Z',
  }
}

describe('GET /v1/admin/sessions/:sessionId/context', () => {
  it('returns 401 without API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/context',
    })
    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 for unknown session', async () => {
    const app = createServer(testConfig, {
      sessionRepository: new InMemorySessionRepository([]),
      conversationRepository: new InMemoryConversationRepository([]),
      avatarRepository: new InMemoryAvatarRepository([]),
      scenarioRepository: new InMemoryScenarioRepository([]),
      messageRepository: new InMemoryMessageRepository([]),
      gmStateRepository: new InMemoryGmStateRepository([]),
    })
    appsToClose.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/missing/context',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(404)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })

  it('returns bounded avatar and gm context sections', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/context',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<AdminSessionContextResponse>>()
    expect(body.error).toBeNull()
    expect(body.data?.sessionId).toBe('session_1')
    expect(body.data?.avatarContext.recentExchanges).toEqual([{ user: 'hello', avatar: 'hi' }])
    expect(body.data?.avatarContext.longTermFacts).toEqual([
      { category: 'preference', key: 'style', value: 'concise' },
    ])
    expect(body.data?.avatarContext.userPersona).toEqual({
      name: 'Maya',
      roleInWorld: 'student',
    })
    expect(body.data?.gmContext.currentState.progression).toBe('intro')
    expect(body.data?.gmContext.recentMessages).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'avatar', content: 'hi' },
    ])
    expect(body.data?.gmContext.memory.workingSummary).toContain('Session summary')
    expect(response.body).not.toContain('personaPrompt')
    expect(response.body).not.toContain('OPENAI_API_KEY')
  })
})
