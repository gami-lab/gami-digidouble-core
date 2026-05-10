import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse, SessionMemoryLayers, SessionMemorySummary } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../../config.js'
import type { Conversation } from '../../domain/conversation/session.types.js'
import type { Session } from '../../domain/conversation/session.types.js'
import type { UserFact } from '../../domain/memory/memory.types.js'
import { InMemoryAvatarSessionMemoryRepository } from '../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryConversationMemoryRepository } from '../../infrastructure/db/in-memory-conversation-memory.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionMemoryRepository } from '../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
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

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:05:00.000Z',
    ...overrides,
  }
}

function makeFact(overrides: Partial<UserFact> = {}): UserFact {
  return {
    id: 'umf_1',
    userId: 'user_1',
    category: 'preference',
    key: 'language',
    value: 'English',
    confidence: 0.8,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

type SeedConversation = {
  conversationId: string
  sessionId: string
  avatarId: string
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string
}

type SeedSessionMemory = { sessionId: string; summary: string; updatedAt: string }

type SeedAvatarMemory = {
  sessionId: string
  avatarId: string
  summary: string
  updatedAt: string
}

type SeedConversationMessage = {
  messageId: string
  conversationId: string
  role: 'user' | 'avatar' | 'system'
  content: string
  createdAt: string
}

type SeedConversationMemory = {
  conversationId: string
  sessionId: string
  userId: string
  avatarId: string
  scenarioId: string
  summary: string
  keyDiscoveries: string[]
  unresolvedTopics: string[]
  factCandidates: Array<{ category: string; key: string; value: string }>
  createdAt: string
}

type SeedConversationWorkingMemory = {
  conversationId: string
  sessionId: string
  avatarId: string
  summary: string
  unresolvedThreads: string[]
  candidateFacts: Array<{ category: string; key: string; value: string }>
  updatedAt: string
}

type SeedEvent = {
  sessionId?: string
  type: string
  severity: 'info' | 'warning' | 'error'
  payload: Record<string, unknown>
  createdAt?: string
}

type AppSeedParams = {
  sessions?: Session[]
  conversations?: SeedConversation[]
  facts?: UserFact[]
  sessionMemories?: SeedSessionMemory[]
  avatarMemories?: SeedAvatarMemory[]
  conversationMessages?: SeedConversationMessage[]
  conversationMemories?: SeedConversationMemory[]
  conversationWorkingMemories?: SeedConversationWorkingMemory[]
  events?: SeedEvent[]
}

function makeApp(params?: AppSeedParams): FastifyInstance {
  const app = createServer(testConfig, buildAdapters(params))
  appsToClose.push(app)
  return app
}

function buildAdapters(params?: AppSeedParams) {
  const resolved = resolveParams(params)
  const eventLogRepository = new InMemoryEventLogRepository()
  for (const event of resolved.events) {
    void eventLogRepository.append(event)
  }
  return {
    sessionRepository: new InMemorySessionRepository(resolved.sessions),
    sessionMemoryRepository: new InMemorySessionMemoryRepository(resolved.sessionMemories),
    avatarSessionMemoryRepository: new InMemoryAvatarSessionMemoryRepository(
      resolved.avatarMemories,
    ),
    conversationRepository: new InMemoryConversationRepository(resolved.conversations),
    messageRepository: new InMemoryMessageRepository(resolved.conversationMessages),
    conversationWorkingMemoryRepository: new InMemoryConversationWorkingMemoryRepository(
      resolved.conversationWorkingMemories,
    ),
    conversationMemoryRepository: new InMemoryConversationMemoryRepository(
      resolved.conversationMemories,
    ),
    eventLogRepository,
    userMemoryFactRepository: new InMemoryUserMemoryFactRepository(resolved.facts),
  }
}

function resolveParams(params: AppSeedParams = {}) {
  const defaults: Required<AppSeedParams> = {
    sessions: [makeSession()],
    conversations: [makeConversation()],
    facts: [],
    sessionMemories: [],
    avatarMemories: [],
    conversationMessages: [],
    conversationMemories: [],
    conversationWorkingMemories: [],
    events: [],
  }
  return { ...defaults, ...params }
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    ...makeConversationBase(),
    ...overrides,
  }
}

function makeConversationBase(): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active' as const,
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:05:00.000Z',
  }
}

function makeLayeredMessages() {
  return [
    {
      messageId: 'msg_1',
      conversationId: 'conversation_1',
      role: 'user' as const,
      content: 'u1',
      createdAt: '2026-05-01T10:01:00.000Z',
    },
    {
      messageId: 'msg_2',
      conversationId: 'conversation_1',
      role: 'avatar' as const,
      content: 'a1',
      createdAt: '2026-05-01T10:01:01.000Z',
    },
    {
      messageId: 'msg_3',
      conversationId: 'conversation_1',
      role: 'user' as const,
      content: 'u2',
      createdAt: '2026-05-01T10:02:00.000Z',
    },
    {
      messageId: 'msg_4',
      conversationId: 'conversation_1',
      role: 'avatar' as const,
      content: 'a2',
      createdAt: '2026-05-01T10:02:01.000Z',
    },
    {
      messageId: 'msg_5',
      conversationId: 'conversation_1',
      role: 'user' as const,
      content: 'u3',
      createdAt: '2026-05-01T10:03:00.000Z',
    },
    {
      messageId: 'msg_6',
      conversationId: 'conversation_1',
      role: 'avatar' as const,
      content: 'a3',
      createdAt: '2026-05-01T10:03:01.000Z',
    },
    {
      messageId: 'msg_7',
      conversationId: 'conversation_1',
      role: 'user' as const,
      content: 'u4',
      createdAt: '2026-05-01T10:04:00.000Z',
    },
    {
      messageId: 'msg_8',
      conversationId: 'conversation_1',
      role: 'avatar' as const,
      content: 'a4',
      createdAt: '2026-05-01T10:04:01.000Z',
    },
  ]
}

function makeLayeredMemoryApp(): FastifyInstance {
  return makeApp({
    facts: [makeFact()],
    conversationMessages: makeLayeredMessages(),
    conversationWorkingMemories: [
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'Active avatar working memory',
        unresolvedThreads: ['follow_up_topic'],
        candidateFacts: [{ category: 'context', key: 'topic', value: 'memory' }],
        updatedAt: '2026-05-01T10:11:00.000Z',
      },
    ],
    conversationMemories: [
      {
        conversationId: 'conversation_old_1',
        sessionId: 'session_1',
        userId: 'user_1',
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        summary: 'Older avatar_1 memory',
        keyDiscoveries: ['k1'],
        unresolvedTopics: ['u1'],
        factCandidates: [],
        createdAt: '2026-05-01T09:00:00.000Z',
      },
    ],
    conversations: [
      makeConversation(),
      makeConversation({
        conversationId: 'conversation_old_1',
        avatarId: 'avatar_1',
        status: 'closed',
        endedAt: '2026-05-01T09:05:00.000Z',
        lastActivityAt: '2026-05-01T09:05:00.000Z',
      }),
    ],
  })
}

function expectLayeredMemoryResponse(session: SessionMemoryLayers | undefined): void {
  expect(session).toBeDefined()
  if (session === undefined) {
    throw new Error('Expected memory session payload to be present')
  }

  expect(session.activeAvatarId).toBe('avatar_1')
  expect(session.activeConversationId).toBe('conversation_1')
  expect(session.shortTerm.recentExchanges).toEqual([
    { user: 'u2', avatar: 'a2' },
    { user: 'u3', avatar: 'a3' },
    { user: 'u4', avatar: 'a4' },
  ])
  expect(session.shortTerm.exchangeCount).toBe(3)
  expect(session.working.current).toEqual({
    conversationId: 'conversation_1',
    avatarId: 'avatar_1',
    summary: 'Active avatar working memory',
    unresolvedThreads: ['follow_up_topic'],
    candidateFacts: [{ category: 'context', key: 'topic', value: 'memory' }],
    updatedAt: '2026-05-01T10:11:00.000Z',
  })
  expect(session.working.session?.summary).toBe('Active avatar working memory')
  expect(session.working.avatars).toEqual([
    {
      avatarId: 'avatar_1',
      summary: 'Active avatar working memory',
      updatedAt: '2026-05-01T10:11:00.000Z',
    },
  ])
  expect(session.longTerm.avatars).toEqual([
    {
      avatarId: 'avatar_1',
      memories: [
        {
          conversationId: 'conversation_old_1',
          summary: 'Older avatar_1 memory',
          keyDiscoveries: ['k1'],
          unresolvedTopics: ['u1'],
          factCandidates: [],
          createdAt: '2026-05-01T09:00:00.000Z',
        },
      ],
    },
  ])
  expect(session.longTerm.facts).toEqual([
    {
      category: 'preference',
      key: 'language',
      value: 'English',
      updatedAt: '2026-05-01T10:00:00.000Z',
    },
  ])
}

describe('GET /v1/admin/sessions/:sessionId/memory', () => {
  it('returns 401 without API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 with wrong API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
      headers: authHeaders('wrong'),
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 404 for unknown session', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/missing/memory',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns empty summary when session has no memorySummary', async () => {
    const response = await makeApp({
      sessions: [makeSession()],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ session: SessionMemorySummary }>>()
    expect(body.error).toBeNull()
    expect(body.data?.session.summary).toBe('')
  })

  it('returns session summary when present', async () => {
    const response = await makeApp({
      sessions: [makeSession({ memorySummary: 'Compacted memory summary' })],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ session: SessionMemorySummary }>>()
    expect(body.error).toBeNull()
    expect(body.data?.session.summary).toBe('Compacted memory summary')
    expect(body.data?.session.shortTerm).toEqual({ exchangeCount: 2 })
    expect(body.data?.session.updatedAt).toBe('2026-05-01T10:05:00.000Z')
    expect(response.body).not.toContain('OPENAI_API_KEY')
    expect(response.body).not.toContain('anthropicApiKey')
  })

  it('derives summary from dedicated session working memory when available', async () => {
    const response = await makeApp({
      sessions: [makeSession({ memorySummary: 'Legacy session summary' })],
      sessionMemories: [
        {
          sessionId: 'session_1',
          summary: 'Dedicated working-memory summary',
          updatedAt: '2026-05-01T11:00:00.000Z',
        },
      ],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ session: SessionMemorySummary }>>()
    expect(body.data?.session.summary).toBe('Dedicated working-memory summary')
    expect(body.data?.session.updatedAt).toBe('2026-05-01T11:00:00.000Z')
  })

  it('returns longTermFactCount from seeded facts', async () => {
    const response = await makeApp({
      facts: [makeFact({ id: 'umf_1' }), makeFact({ id: 'umf_2', key: 'role', value: 'friend' })],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ session: SessionMemorySummary }>>()
    expect(body.error).toBeNull()
    expect(body.data?.session.longTermFactCount).toBe(2)
  })
})

describe('GET /v1/admin/sessions/:sessionId/memory-layers', () => {
  it('returns 401 without API key', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory-layers',
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 404 for unknown session', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/missing/memory-layers',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(404)
  })

  it('returns layered memory without raw transcript replay', async () => {
    const response = await makeLayeredMemoryApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory-layers',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ session: SessionMemoryLayers }>>()
    expect(body.error).toBeNull()
    expectLayeredMemoryResponse(body.data?.session)
    expect(response.body).not.toContain('You are a helpful guide')
    expect(response.body).not.toContain('OPENAI_API_KEY')
  })

  it('prefers canonical working memory of the latest conversation over the legacy session mirror', async () => {
    const response = await makeApp({
      sessions: [makeSession()],
      sessionMemories: [
        {
          sessionId: 'session_1',
          summary: 'Legacy session mirror',
          updatedAt: '2026-05-01T10:10:00.000Z',
        },
      ],
      conversationWorkingMemories: [
        {
          conversationId: 'conversation_1',
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          summary: 'Canonical active conversation memory',
          unresolvedThreads: ['follow_up'],
          candidateFacts: [],
          updatedAt: '2026-05-01T10:12:00.000Z',
        },
      ],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory-layers',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ session: SessionMemoryLayers }>>()
    expect(body.data?.session.working.session?.summary).toBe('Canonical active conversation memory')
    expect(body.data?.session.working.session?.updatedAt).toBe('2026-05-01T10:12:00.000Z')
    expect(body.data?.session.working.current?.summary).toBe('Canonical active conversation memory')
  })
})
