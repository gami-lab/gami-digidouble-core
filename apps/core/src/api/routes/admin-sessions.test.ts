import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { StoredEvent } from '../../application/ports/IEventLogRepository.js'
import type { Conversation, Session } from '../../domain/conversation/session.types.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryGmStateRepository } from '../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

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

function makeEvent(overrides: Partial<StoredEvent> = {}): StoredEvent {
  return {
    sessionId: 'session_1',
    type: 'gm_triggered',
    severity: 'info',
    correlationId: 'corr_1',
    createdAt: '2026-04-28T10:05:00.000Z',
    payload: {
      triggerReason: 'post_turn_observation',
      turnIndex: 5,
      interactionCount: 5,
      stateBefore: {
        currentAvatarId: 'avatar_1',
        progression: 'intro',
        topicsCovered: ['setup'],
      },
      decision: {
        dialogueMode: 'transition',
        askFollowUp: false,
        notesInjected: true,
        retrievalRequired: false,
        routingAction: 'switch',
        routingAvatarId: 'avatar_2',
        progression: 'none',
      },
      latencyMs: 12,
      userMessageText: 'secret user input',
      systemPrompt: 'hidden prompt',
    },
    ...overrides,
  }
}

function makeApp(params?: {
  sessions?: Session[]
  conversations?: Conversation[]
  events?: StoredEvent[]
}): FastifyInstance {
  const eventLogRepository = new InMemoryEventLogRepository()
  for (const event of params?.events ?? []) {
    void eventLogRepository.append(event)
  }

  const app = createServer(TEST_CONFIG, {
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
          reason: 'post_turn_observation',
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
    eventLogRepository,
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

  // eslint-disable-next-line complexity
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
          effectiveModels: {
            avatar: { provider: string; model: string }
            gameMaster: { provider: string; model: string }
            memory: { provider: string; model: string }
          }
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
    expect(typeof body.data?.inspect.effectiveModels).toBe('object')
    expect(typeof body.data?.inspect.effectiveModels.avatar.provider).toBe('string')
    expect(typeof body.data?.inspect.effectiveModels.avatar.model).toBe('string')
    expect(typeof body.data?.inspect.effectiveModels.gameMaster.provider).toBe('string')
    expect(typeof body.data?.inspect.effectiveModels.gameMaster.model).toBe('string')
    expect(typeof body.data?.inspect.effectiveModels.memory.provider).toBe('string')
    expect(typeof body.data?.inspect.effectiveModels.memory.model).toBe('string')
    expect(body.data?.inspect.transitionHistory).toEqual([
      {
        fromAvatarId: 'avatar_1',
        toAvatarId: 'avatar_2',
        reason: 'post_turn_observation',
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

describe('GET /v1/admin/sessions/:sessionId/events', () => {
  it('requires a valid API key', async () => {
    const app = makeApp()

    const missing = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events',
    })
    const wrong = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events',
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
      url: '/v1/admin/sessions/session_missing/events',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })
})

describe('GET /v1/admin/sessions/:sessionId/events behavior', () => {
  it('returns newest-first safe GM events and excludes non-GM events', async () => {
    const app = makeApp({
      events: [
        makeEvent({ type: 'system_internal', correlationId: 'corr_internal' }),
        makeEvent({ type: 'gm_error', severity: 'error', correlationId: 'corr_old' }),
        makeEvent({ type: 'gm_triggered', correlationId: 'corr_new' }),
      ],
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<
      ApiResponse<{
        events: Array<{
          type: string
          correlationId: string
          createdAt: string
          payload: Record<string, unknown>
        }>
      }>
    >()
    expect(body.error).toBeNull()
    expect(body.data?.events.map((event) => event.correlationId)).toEqual(['corr_new', 'corr_old'])
    expect(body.data?.events[0]?.payload).toEqual({
      triggerReason: 'post_turn_observation',
      turnIndex: 5,
      interactionCount: 5,
      stateBefore: {
        currentAvatarId: 'avatar_1',
        progression: 'intro',
        topicsCovered: ['setup'],
      },
      decision: {
        dialogueMode: 'transition',
        askFollowUp: false,
        notesInjected: true,
        retrievalRequired: false,
        routingAction: 'switch',
        routingAvatarId: 'avatar_2',
        progression: 'none',
      },
      latencyMs: 12,
    })
    expect(response.body).not.toContain('system_internal')
    expect(response.body).not.toContain('secret user input')
    expect(response.body).not.toContain('hidden prompt')
  })
})

describe('GET /v1/admin/sessions/:sessionId/events turn-completed behavior', () => {
  it('returns turn_completed events in safe shape', async () => {
    const app = makeApp({
      events: [
        makeEvent({
          type: 'turn_completed',
          correlationId: 'corr_turn',
          payload: {
            correlationId: 'corr_turn',
            conversationId: 'conversation_1',
            turnIndex: 3,
            avatarId: 'avatar_1',
            avatarLatencyMs: 16,
            totalTurnLatencyMs: 24,
            inputTokens: 13,
            outputTokens: 21,
            totalTokens: 34,
            model: 'null-model',
            hasGm: true,
            userMessageText: 'secret user input',
          },
        }),
      ],
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ events: Array<{ type: string; payload: unknown }> }>>()
    expect(body.data?.events[0]).toEqual(
      expect.objectContaining({
        type: 'turn_completed',
        payload: {
          correlationId: 'corr_turn',
          conversationId: 'conversation_1',
          turnIndex: 3,
          avatarId: 'avatar_1',
          avatarLatencyMs: 16,
          totalTurnLatencyMs: 24,
          inputTokens: 13,
          outputTokens: 21,
          totalTokens: 34,
          model: 'null-model',
          hasGm: true,
        },
      }),
    )
    expect(response.body).not.toContain('secret user input')
  })
})

describe('GET /v1/admin/sessions/:sessionId/events pagination behavior', () => {
  it('validates limit, defaults to 50, and clamps to 200', async () => {
    const events = Array.from({ length: 205 }, (_, index) =>
      makeEvent({ correlationId: `corr_${String(index).padStart(3, '0')}` }),
    )
    const app = makeApp({ events })

    const invalid = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events?limit=-1',
      headers: authHeaders(),
    })
    const decimal = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events?limit=1.5',
      headers: authHeaders(),
    })
    const defaultLimit = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events',
      headers: authHeaders(),
    })
    const clamped = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/events?limit=999',
      headers: authHeaders(),
    })

    expect(invalid.statusCode).toBe(400)
    expect(decimal.statusCode).toBe(400)
    expect(defaultLimit.json<ApiResponse<{ events: unknown[] }>>().data?.events).toHaveLength(50)
    expect(clamped.json<ApiResponse<{ events: unknown[] }>>().data?.events).toHaveLength(200)
  })
})
