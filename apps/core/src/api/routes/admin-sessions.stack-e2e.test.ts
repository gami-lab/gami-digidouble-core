import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { StoredEvent } from '../../application/ports/IEventLogRepository.js'
import type { Message, Session } from '../../domain/conversation/session.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryGmStateRepository } from '../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

function registerApp(app: FastifyInstance): FastifyInstance {
  appsToClose.push(app)
  return app
}

function makeSession(): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    unlockedAvatarIds: ['avatar_1'],
    status: 'active',
    startedAt: '2026-04-28T10:00:00.000Z',
    lastActivityAt: '2026-04-28T10:05:00.000Z',
  }
}

function makeRawMessage(): Message {
  return {
    messageId: 'msg_1',
    conversationId: 'conversation_1',
    role: 'user',
    content: 'raw secret user message',
    createdAt: '2026-04-28T10:01:00.000Z',
  }
}

function makeEvent(type: StoredEvent['type'], correlationId: string): StoredEvent {
  const isError = type === 'gm_error'
  return {
    sessionId: 'session_1',
    type,
    severity: isError ? 'error' : 'info',
    correlationId,
    payload: {
      triggerReason: 'post_turn_observation',
      turnIndex: 5,
      interactionCount: 5,
      stateBefore: {
        currentAvatarId: 'avatar_1',
        progression: 'intro',
        topicsCovered: ['setup'],
      },
      latencyMs: 8,
      ...(isError ? { errorCode: 'llm_error' } : {}),
      userMessageText: 'raw secret user message',
    },
  }
}

function makeApp(params?: { sessions?: Session[]; events?: StoredEvent[] }): FastifyInstance {
  const eventLogRepository = new InMemoryEventLogRepository()
  for (const event of params?.events ?? []) {
    void eventLogRepository.append(event)
  }

  return registerApp(
    createServer(TEST_CONFIG, {
      scenarioRepository: new InMemoryScenarioRepository([
        {
          scenarioId: 'scenario_1',
          name: 'Scenario',
          status: 'active',
          config: {},
          createdAt: '2026-04-28T09:00:00.000Z',
          updatedAt: '2026-04-28T09:00:00.000Z',
        },
      ]),
      avatarRepository: new InMemoryAvatarRepository([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar',
          status: 'active',
          personaPrompt: 'You are an avatar.',
          config: {},
          createdAt: '2026-04-28T09:01:00.000Z',
          updatedAt: '2026-04-28T09:01:00.000Z',
        },
      ]),
      sessionRepository: new InMemorySessionRepository(params?.sessions ?? [makeSession()]),
      gmStateRepository: new InMemoryGmStateRepository(),
      conversationRepository: new InMemoryConversationRepository(),
      messageRepository: new InMemoryMessageRepository([makeRawMessage()]),
      eventLogRepository,
    }),
  )
}

describe('GET /v1/admin/sessions/:id/inspect — auth', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/inspect',
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/inspect',
      headers: authHeaders('wrong-key'),
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /v1/admin/sessions/:id/events — auth', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events',
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events',
      headers: authHeaders('wrong-key'),
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /v1/admin/sessions/:id/inspect — not found', () => {
  it('returns 404 for unknown sessionId', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_missing/inspect',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
  })
})

describe('GET /v1/admin/sessions/:id/events — not found', () => {
  it('returns 404 for unknown sessionId', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_missing/events',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
  })
})

describe('GET /v1/admin/sessions/:id/events — validation', () => {
  it('returns 400 when limit is not a valid integer', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events?limit=1.5',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when limit is negative', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events?limit=-1',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(400)
  })
})

describe('GET /v1/admin/sessions/:id/inspect — happy path', () => {
  it('returns an admin-safe inspect snapshot', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/inspect',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body =
      response.json<
        ApiResponse<{ inspect: { session: Session; gmState: null; transitionHistory: unknown[] } }>
      >()
    expect(body.error).toBeNull()
    expect(body.data?.inspect.session.sessionId).toBe('session_1')
    expect(body.data?.inspect.gmState).toBeNull()
    expect(Array.isArray(body.data?.inspect.transitionHistory)).toBe(true)
    expect(response.body).not.toContain('raw secret user message')
    expect(response.body).not.toContain('"content"')
  })
})

describe('GET /v1/admin/sessions/:id/events — happy path', () => {
  it('returns newest-first GM events and respects limit', async () => {
    const response = await makeApp({
      events: [
        makeEvent('gm_triggered', 'corr_old'),
        makeEvent('system_internal', 'corr_internal'),
        makeEvent('gm_error', 'corr_new'),
      ],
    }).inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events?limit=1',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ events: Array<{ type: string }> }>>()
    expect(body.error).toBeNull()
    expect(body.data?.events).toHaveLength(1)
    expect(body.data?.events[0]?.type).toBe('gm_error')
    expect(response.body).not.toContain('system_internal')
    expect(response.body).not.toContain('raw secret user message')
  })
})
