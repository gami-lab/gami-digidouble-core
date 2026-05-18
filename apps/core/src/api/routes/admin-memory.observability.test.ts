import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse, SessionMemoryLayers } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import { InMemoryConversationMemoryRepository } from '../../infrastructure/db/in-memory-conversation-memory.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const config = TEST_CONFIG

const apps: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()))
})

describe('GET /v1/admin/sessions/:sessionId/memory-layers observability', () => {
  it('returns memory selection and hydration observability metadata', async () => {
    const eventLog = new InMemoryEventLogRepository()
    await eventLog.append({
      sessionId: 'session_1',
      type: 'memory_hydration_succeeded',
      severity: 'info',
      payload: {
        hydratedConversationId: 'conversation_1',
        sourceConversationIds: ['conversation_ep_1'],
      },
    })
    const app = createServer(config, {
      sessionRepository: new InMemorySessionRepository([
        {
          sessionId: 'session_1',
          userId: 'user_1',
          scenarioId: 'scenario_1',
          status: 'active',
          startedAt: '2026-05-01T10:00:00.000Z',
          lastActivityAt: '2026-05-01T10:05:00.000Z',
        },
      ]),
      conversationRepository: new InMemoryConversationRepository([
        {
          conversationId: 'conversation_1',
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          status: 'active',
          startedAt: '2026-05-01T10:00:00.000Z',
          lastActivityAt: '2026-05-01T10:05:00.000Z',
        },
      ]),
      messageRepository: new InMemoryMessageRepository([
        {
          messageId: 'msg_1',
          conversationId: 'conversation_1',
          role: 'user',
          content: 'Need budget plan',
          createdAt: '2026-05-01T10:01:00.000Z',
        },
      ]),
      conversationWorkingMemoryRepository: new InMemoryConversationWorkingMemoryRepository([
        {
          conversationId: 'conversation_1',
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          summary: 'Working summary',
          unresolvedThreads: ['Need budget plan'],
          candidateFacts: [],
          updatedAt: '2026-05-01T10:04:00.000Z',
        },
      ]),
      conversationMemoryRepository: new InMemoryConversationMemoryRepository([
        {
          conversationId: 'conversation_ep_1',
          sessionId: 'session_old_1',
          userId: 'user_1',
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          summary: 'Budget discussion',
          keyDiscoveries: ['Budget plan'],
          unresolvedTopics: ['Need budget plan'],
          factCandidates: [],
          createdAt: '2026-04-20T10:00:00.000Z',
        },
      ]),
      eventLogRepository: eventLog,
      userMemoryFactRepository: new InMemoryUserMemoryFactRepository([]),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/sessions/session_1/memory-layers',
      headers: { 'x-api-key': 'test-secret' },
    })

    const body = response.json<ApiResponse<{ session: SessionMemoryLayers }>>()
    expect(body.data?.session.observability?.selection?.sourceConversationIds).toContain(
      'conversation_ep_1',
    )
    expect(body.data?.session.observability?.hydration?.hydratedConversationId).toBe(
      'conversation_1',
    )
  })
})
