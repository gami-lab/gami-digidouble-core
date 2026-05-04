import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { Config } from '../../config.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { Conversation, Session } from '../../domain/conversation/session.types.js'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { NullLlmAdapter } from '../../infrastructure/llm/index.js'
import { NullObservabilityAdapter } from '../../infrastructure/observability/index.js'
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

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    config: {},
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava.',
    config: {},
    createdAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z',
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeApp(): ReturnType<typeof createServer> {
  return createServer(testConfig, {
    llmAdapter: new NullLlmAdapter('Avatar reply', 'null-model'),
    observabilityAdapter: new NullObservabilityAdapter(),
    scenarioRepository: new InMemoryScenarioRepository([makeScenario()]),
    avatarRepository: new InMemoryAvatarRepository([makeAvatar()]),
    sessionRepository: new InMemorySessionRepository([makeSession()]),
    conversationRepository: new InMemoryConversationRepository([makeConversation()]),
    messageRepository: new InMemoryMessageRepository(),
  })
}

describe('POST /v1/conversations/:conversationId/messages auth', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/messages',
      payload: { message: { content: 'hello' } },
    })
    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/messages',
      headers: { 'x-api-key': 'wrong-key' },
      payload: { message: { content: 'hello' } },
    })
    expect(response.statusCode).toBe(401)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })
})

describe('POST /v1/conversations/:conversationId/messages behavior', () => {
  it('returns 400 for invalid payload', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: {} },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for unknown conversation', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/conversation_unknown/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: { content: 'hello' } },
    })
    expect(response.statusCode).toBe(404)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })

  it('returns 200 and keeps active status for normal messages', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: { content: 'Tell me more.' } },
    })
    expect(response.statusCode).toBe(200)
    const body =
      response.json<ApiResponse<{ conversation: { status: string; endedAt?: string } }>>()
    expect(body.data?.conversation.status).toBe('active')
    expect(body.data?.conversation.endedAt).toBeUndefined()
  })

  it('returns 200 and closes conversation for terminal signals', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: { content: 'bye' } },
    })
    expect(response.statusCode).toBe(200)
    const body =
      response.json<ApiResponse<{ conversation: { status: string; endedAt?: string } }>>()
    expect(body.data?.conversation.status).toBe('closed')
    expect(body.data?.conversation.endedAt).toBeTypeOf('string')
  })
})
