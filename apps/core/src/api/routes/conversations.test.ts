import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { Config } from '../../config.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../domain/conversation/session.types.js'
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
    personaPrompt: 'You are Ava, a helpful guide.',
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

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    messageId: 'msg_1',
    conversationId: 'conversation_1',
    role: 'user',
    content: 'Hello',
    createdAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeApp({
  scenarios = [makeScenario()],
  avatars = [makeAvatar()],
  sessions = [makeSession()],
  conversations = [makeConversation()],
  messages = [],
}: {
  scenarios?: Scenario[]
  avatars?: AvatarConfig[]
  sessions?: Session[]
  conversations?: Conversation[]
  messages?: Message[]
} = {}) {
  return createServer(testConfig, {
    llmAdapter: new NullLlmAdapter('Avatar reply', 'null-model'),
    observabilityAdapter: new NullObservabilityAdapter(),
    scenarioRepository: new InMemoryScenarioRepository(scenarios),
    avatarRepository: new InMemoryAvatarRepository(avatars),
    sessionRepository: new InMemorySessionRepository(sessions),
    conversationRepository: new InMemoryConversationRepository(conversations),
    messageRepository: new InMemoryMessageRepository(messages),
  })
}

describe('session API', () => {
  it('creates a session with POST /v1/sessions', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { 'x-api-key': 'test-secret' },
      payload: { userId: 'user_x', scenarioId: 'scenario_1' },
    })
    expect(response.statusCode).toBe(201)
    const body = response.json<ApiResponse<{ session: { sessionId: string } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.session.sessionId.startsWith('session_')).toBe(true)
  })

  it('starts a conversation inside a session', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/sessions/session_1/conversations',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'avatar_1' },
    })
    expect(response.statusCode).toBe(201)
    const body = response.json<ApiResponse<{ conversation: { avatarId: string } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.conversation.avatarId).toBe('avatar_1')
  })

  it('returns 404 for invalid sessionId on start conversation', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'POST',
      url: '/v1/sessions/session_missing/conversations',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'avatar_1' },
    })
    expect(response.statusCode).toBe(404)
  })
})

describe('conversation message/history API', () => {
  it('sends message using conversationId and gets isolated history', async () => {
    const app = makeApp({
      conversations: [
        makeConversation({ conversationId: 'conversation_1', avatarId: 'avatar_1' }),
        makeConversation({ conversationId: 'conversation_2', avatarId: 'avatar_2' }),
        makeConversation({ conversationId: 'conversation_3', avatarId: 'avatar_1' }),
      ],
      avatars: [makeAvatar({ avatarId: 'avatar_1' }), makeAvatar({ avatarId: 'avatar_2' })],
      messages: [
        makeMessage({
          messageId: 'msg_conv2',
          conversationId: 'conversation_2',
          content: 'Only in conversation 2',
        }),
      ],
    })

    const sendResponse = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: { content: 'Hello from conversation 1' } },
    })
    expect(sendResponse.statusCode).toBe(200)

    const history1 = await app.inject({
      method: 'GET',
      url: '/v1/conversations/conversation_1/history',
      headers: { 'x-api-key': 'test-secret' },
    })
    const history2 = await app.inject({
      method: 'GET',
      url: '/v1/conversations/conversation_2/history',
      headers: { 'x-api-key': 'test-secret' },
    })
    expect(history1.statusCode).toBe(200)
    expect(history2.statusCode).toBe(200)

    const body1 = history1.json<ApiResponse<{ messages: Message[] }>>()
    const body2 = history2.json<ApiResponse<{ messages: Message[] }>>()
    expect(body1.data?.messages.map((message) => message.content)).toEqual([
      'Hello from conversation 1',
      'Avatar reply',
    ])
    expect(body2.data?.messages.map((message) => message.content)).toEqual([
      'Only in conversation 2',
    ])
  })

  it('returns 404 for invalid conversationId on send/history', async () => {
    const app = makeApp({ conversations: [] })
    const sendResponse = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_missing/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: { content: 'Hello' } },
    })
    const historyResponse = await app.inject({
      method: 'GET',
      url: '/v1/conversations/conversation_missing/history',
      headers: { 'x-api-key': 'test-secret' },
    })
    expect(sendResponse.statusCode).toBe(404)
    expect(historyResponse.statusCode).toBe(404)
  })
})

describe('session conversation listing API', () => {
  it('lists conversations for a session', async () => {
    const response = await makeApp({
      conversations: [
        makeConversation({ conversationId: 'conversation_1', avatarId: 'avatar_1' }),
        makeConversation({ conversationId: 'conversation_2', avatarId: 'avatar_2' }),
        makeConversation({ conversationId: 'conversation_3', sessionId: 'session_2' }),
      ],
    }).inject({
      method: 'GET',
      url: '/v1/sessions/session_1/conversations',
      headers: { 'x-api-key': 'test-secret' },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ conversations: Array<{ conversationId: string }> }>>()
    expect(body.data?.conversations.map((item) => item.conversationId)).toEqual([
      'conversation_1',
      'conversation_2',
    ])
  })
})
