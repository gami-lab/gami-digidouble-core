import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse, AdminSessionContextResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import { createServer } from '../server.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { TEST_CONFIG } from './test-config.js'

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

function makeApp(): FastifyInstance {
  const app = createServer(TEST_CONFIG, buildAdapters())
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
    conversationWorkingMemoryRepository: new InMemoryConversationWorkingMemoryRepository([
      makeWorkingMemory(),
    ]),
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

function makeWorkingMemory() {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    summary: 'Working summary',
    unresolvedThreads: ['thread_1'],
    candidateFacts: [],
    updatedAt: '2026-05-01T10:00:30.000Z',
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
    const app = createServer(TEST_CONFIG, {
      sessionRepository: new InMemorySessionRepository([]),
      conversationRepository: new InMemoryConversationRepository([]),
      avatarRepository: new InMemoryAvatarRepository([]),
      scenarioRepository: new InMemoryScenarioRepository([]),
      messageRepository: new InMemoryMessageRepository([]),
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
    assertContextBody(body)
    assertContextResponseRedaction(response.body)
  })
})

function assertContextBody(body: ApiResponse<AdminSessionContextResponse>): void {
  assertCoreContextShape(body)
  assertContextTraceBounds(body)
}

function assertCoreContextShape(body: ApiResponse<AdminSessionContextResponse>): void {
  expect(body.error).toBeNull()
  expect(body.data?.sessionId).toBe('session_1')
  expect(body.data?.avatarPrompt).toBe('You are Guide.')
  expect(body.data?.worldContext).toBe('World')
  expect(body.data?.worldObjectives).toEqual(['Obj'])
  expect(body.data?.gmInstruction).toBe('Follow up with concrete examples.')
  expect(body.data?.workingMemory).toEqual({
    summary: 'Working summary',
    unresolvedThreads: ['thread_1'],
    updatedAt: '2026-05-01T10:00:30.000Z',
  })
  expect(body.data?.currentExchanges).toEqual([{ user: 'hello', avatar: 'hi' }])
}

function assertContextTraceBounds(body: ApiResponse<AdminSessionContextResponse>): void {
  expect(body.data?.currentExchanges.length).toBeLessThanOrEqual(1)
}

function assertContextResponseRedaction(rawBody: string): void {
  expect(rawBody).not.toContain('OPENAI_API_KEY')
  expect(rawBody).not.toContain('systemPrompt')
  expect(rawBody).not.toContain('apiKeySecret')
}
