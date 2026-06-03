/* eslint-disable max-lines-per-function */
import { describe, expect, it, vi } from 'vitest'
import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import { ListSessionEventsUseCase } from './list-session-events.use-case.js'

function makeSession(): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-28T10:00:00.000Z',
    lastActivityAt: '2026-04-28T10:05:00.000Z',
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
      gmContext: {
        recentMessages: [{ role: 'user', content: 'Who left last night?' }],
        memory: {
          shortTerm: { recentExchanges: [{ user: 'u', avatar: 'a' }] },
          workingSummary: 'Working summary',
          longTermFacts: [
            {
              category: 'context',
              key: 'k',
              value: 'v',
            },
          ],
        },
        knowledge: {
          memory: [],
          world: [
            {
              sourceId: 'source_1',
              chunkId: 'chunk_1',
              knowledgeType: 'world',
              content: 'World clue',
              visibleToAvatarIds: ['avatar_1'],
            },
          ],
          media: [],
        },
        currentState: {
          currentAvatarId: 'avatar_1',
          progression: 'intro',
          topicsCovered: ['setup'],
          interactionCount: 5,
        },
        availableAvatars: [{ avatarId: 'avatar_1', name: 'Clara', availability: 'available' }],
        userPersona: { name: 'Maya', roleInWorld: 'inspector' },
        scenario: { scenarioId: 'scenario_1', name: 'Villa Miralac' },
      },
      decision: {
        avatarId: 'avatar_2',
        conversationMode: 'new',
        notesInjected: true,
        injectedNote: 'Ask Theo for concrete implementation details next.',
        directiveCount: 1,
        unlockEvaluations: [
          {
            avatarId: 'avatar_2',
            avatarName: 'Theo',
            reason: 'Technical specialist requested.',
            outcome: 'unlocked',
          },
        ],
      },
      stateAfter: {
        currentAvatarId: 'avatar_2',
        progression: 'advanced',
        topicsCovered: ['setup', 'handoff'],
      },
      latencyMs: 12,
      totalLatencyMs: 18,
      inputTokens: 20,
      outputTokens: 30,
      userMessageText: 'secret user input',
      systemPrompt: 'hidden prompt',
    },
    ...overrides,
  }
}

function createUseCase(params?: { session?: Session | null; events?: StoredEvent[] }): {
  useCase: ListSessionEventsUseCase
  findBySessionIdMock: ReturnType<typeof vi.fn>
} {
  const session = Object.hasOwn(params ?? {}, 'session') ? params?.session : makeSession()
  const findBySessionIdMock = vi.fn().mockResolvedValue(params?.events ?? [])
  const sessionRepository: ISessionRepository = {
    findById: vi.fn().mockResolvedValue(session),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    countByScenarioId: vi.fn(),
    countActiveByScenarioId: vi.fn(),
  }
  const eventLogRepository: IEventLogRepository = {
    append: vi.fn(),
    findBySessionId: findBySessionIdMock,
  }

  return {
    useCase: new ListSessionEventsUseCase(sessionRepository, eventLogRepository),
    findBySessionIdMock,
  }
}

function makeErrorEvent(): StoredEvent {
  return makeEvent({
    type: 'gm_error',
    severity: 'error',
    correlationId: 'corr_error',
    createdAt: '2026-04-28T10:06:00.000Z',
    payload: {
      triggerReason: 'post_turn_observation',
      turnIndex: 6,
      interactionCount: 6,
      stateBefore: { currentAvatarId: 'avatar_1', progression: 'intro', topicsCovered: ['setup'] },
      latencyMs: 2,
      errorCode: 'llm_error',
      userMessageText: 'secret skip input',
    },
  })
}

describe('ListSessionEventsUseCase — filtering', () => {
  it('includes gm and turn_completed events; excludes unrelated system_internal', async () => {
    const { useCase } = createUseCase({
      events: [
        makeEvent({ type: 'system_internal', correlationId: 'corr_internal' }),
        makeEvent({
          type: 'turn_completed',
          payload: {
            conversationId: 'conversation_1',
            turnIndex: 5,
            avatarId: 'avatar_1',
            avatarLatencyMs: 11,
            totalTurnLatencyMs: 22,
            inputTokens: 9,
            outputTokens: 7,
            totalTokens: 16,
            model: 'null-model',
            hasGm: true,
          },
        }),
        makeEvent(),
        makeEvent({
          type: 'gm_error',
          severity: 'error',
          correlationId: 'corr_2',
          createdAt: '2026-04-28T10:04:00.000Z',
          payload: {
            triggerReason: 'post_turn_observation',
            turnIndex: 4,
            interactionCount: 4,
            stateBefore: { progression: 'intro', topicsCovered: [] },
            latencyMs: 3,
            errorCode: 'invalid_output',
          },
        }),
      ],
    })

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.events.map((event) => event.type)).toEqual([
      'turn_completed',
      'gm_triggered',
      'gm_error',
    ])
  })
})

describe('ListSessionEventsUseCase — gm payload safety', () => {
  it('maps gm_triggered payload to safe shape and strips sensitive fields', async () => {
    const { useCase } = createUseCase({ events: [makeEvent()] })

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.events[0]).toEqual({
      type: 'gm_triggered',
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
        gmContext: {
          recentMessages: [{ role: 'user', content: 'Who left last night?' }],
          memory: {
            shortTerm: { recentExchanges: [{ user: 'u', avatar: 'a' }] },
            workingSummary: 'Working summary',
            longTermFacts: [
              {
                category: 'context',
                key: 'k',
                value: 'v',
              },
            ],
          },
          knowledge: {
            memory: [],
            world: [
              {
                sourceId: 'source_1',
                chunkId: 'chunk_1',
                knowledgeType: 'world',
                content: 'World clue',
                visibleToAvatarIds: ['avatar_1'],
              },
            ],
            media: [],
          },
          currentState: {
            currentAvatarId: 'avatar_1',
            progression: 'intro',
            topicsCovered: ['setup'],
            interactionCount: 5,
          },
          availableAvatars: [{ avatarId: 'avatar_1', name: 'Clara', availability: 'available' }],
          userPersona: { name: 'Maya', roleInWorld: 'inspector' },
          scenario: { scenarioId: 'scenario_1', name: 'Villa Miralac' },
        },
        decision: {
          avatarId: 'avatar_2',
          conversationMode: 'new',
          notesInjected: true,
          injectedNote: 'Ask Theo for concrete implementation details next.',
          directiveCount: 1,
          unlockEvaluations: [
            {
              avatarId: 'avatar_2',
              avatarName: 'Theo',
              reason: 'Technical specialist requested.',
              outcome: 'unlocked',
            },
          ],
        },
        stateAfter: {
          currentAvatarId: 'avatar_2',
          progression: 'advanced',
          topicsCovered: ['setup', 'handoff'],
        },
        latencyMs: 12,
        totalLatencyMs: 18,
        inputTokens: 20,
        outputTokens: 30,
      },
    })
    expect(JSON.stringify(output)).not.toContain('secret user input')
    expect(JSON.stringify(output)).not.toContain('hidden prompt')
  })

  it('maps gm_error events to the correct safe output shape', async () => {
    const { useCase } = createUseCase({ events: [makeErrorEvent()] })

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.events).toHaveLength(1)
    expect(output.events[0]).toEqual({
      type: 'gm_error',
      correlationId: 'corr_error',
      createdAt: '2026-04-28T10:06:00.000Z',
      payload: {
        triggerReason: 'post_turn_observation',
        turnIndex: 6,
        interactionCount: 6,
        stateBefore: {
          currentAvatarId: 'avatar_1',
          progression: 'intro',
          topicsCovered: ['setup'],
        },
        latencyMs: 2,
        errorCode: 'llm_error',
      },
    })
    expect(JSON.stringify(output)).not.toContain('secret skip input')
  })
})

describe('ListSessionEventsUseCase — turn completed mapping', () => {
  it('maps turn_completed payload to safe shape', async () => {
    const { useCase } = createUseCase({
      events: [
        makeEvent({
          type: 'turn_completed',
          payload: {
            conversationId: 'conversation_1',
            turnIndex: 2,
            avatarId: 'avatar_1',
            avatarContext: {
              avatarId: 'avatar_1',
              recentExchanges: [{ user: 'u1', avatar: 'a1' }],
              workingMemory: {
                session: { summary: 'Session memory', updatedAt: '2026-04-28T10:05:00.000Z' },
                avatar: {
                  avatarId: 'avatar_1',
                  summary: 'Avatar memory',
                  updatedAt: '2026-04-28T10:05:00.000Z',
                },
              },
              longTermFacts: [
                {
                  category: 'goal',
                  key: 'focus',
                  value: 'truth',
                },
              ],
              knowledge: {
                retrievedItems: [
                  {
                    sourceId: 'source_1',
                    chunkId: 'chunk_1',
                    knowledgeType: 'world',
                    content: 'A clue',
                    visibleToAvatarIds: ['avatar_1'],
                  },
                ],
              },
              userPersona: { name: 'Maya', roleInWorld: 'inspector' },
              gmNotes: 'Ask about the glass.',
              scenario: { scenarioId: 'scenario_1', name: 'Villa Miralac' },
            },
            avatarLatencyMs: 8,
            totalTurnLatencyMs: 19,
            inputTokens: 13,
            outputTokens: 21,
            totalTokens: 34,
            model: 'null-model',
            hasGm: false,
            retrievalLatencyMs: 14,
            otherOverheadMs: 6,
          },
        }),
      ],
    })

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.events).toEqual([
      {
        type: 'turn_completed',
        correlationId: 'corr_1',
        createdAt: '2026-04-28T10:05:00.000Z',
        payload: {
          conversationId: 'conversation_1',
          turnIndex: 2,
          avatarId: 'avatar_1',
          avatarContext: {
            avatarId: 'avatar_1',
            recentExchanges: [{ user: 'u1', avatar: 'a1' }],
            workingMemory: {
              session: { summary: 'Session memory', updatedAt: '2026-04-28T10:05:00.000Z' },
              avatar: {
                avatarId: 'avatar_1',
                summary: 'Avatar memory',
                updatedAt: '2026-04-28T10:05:00.000Z',
              },
            },
            longTermFacts: [
              {
                category: 'goal',
                key: 'focus',
                value: 'truth',
              },
            ],
            knowledge: {
              retrievedItems: [
                {
                  sourceId: 'source_1',
                  chunkId: 'chunk_1',
                  knowledgeType: 'world',
                  content: 'A clue',
                  visibleToAvatarIds: ['avatar_1'],
                },
              ],
            },
            userPersona: { name: 'Maya', roleInWorld: 'inspector' },
            gmNotes: 'Ask about the glass.',
            scenario: { scenarioId: 'scenario_1', name: 'Villa Miralac' },
          },
          avatarLatencyMs: 8,
          totalTurnLatencyMs: 19,
          inputTokens: 13,
          outputTokens: 21,
          totalTokens: 34,
          model: 'null-model',
          hasGm: false,
          retrievalLatencyMs: 14,
          otherOverheadMs: 6,
        },
      },
    ])
  })
})

describe('ListSessionEventsUseCase — memory refresh mapping', () => {
  it('maps memory_refresh_succeeded payload with full memory fields', async () => {
    const { useCase } = createUseCase({
      events: [
        makeEvent({
          type: 'memory_refresh_succeeded',
          payload: {
            sessionId: 'session_1',
            conversationId: 'conversation_1',
            avatarId: 'avatar_1',
            trigger: 'post_turn',
            workingSummary: 'User is planning a pilot and wants clear first steps.',
            messageCount: 6,
            unresolvedThreads: ['Which metric to optimize first'],
            candidateFacts: [
              {
                category: 'goal',
                key: 'pilot_validation',
                value: 'Validate first value in one session',
              },
            ],
            exchangeCount: 3,
          },
        }),
      ],
    })

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.events).toEqual([
      {
        type: 'memory_refresh_succeeded',
        correlationId: 'corr_1',
        createdAt: '2026-04-28T10:05:00.000Z',
        payload: {
          sessionId: 'session_1',
          conversationId: 'conversation_1',
          avatarId: 'avatar_1',
          trigger: 'post_turn',
          workingSummary: 'User is planning a pilot and wants clear first steps.',
          messageCount: 6,
          unresolvedThreads: ['Which metric to optimize first'],
          candidateFacts: [
            {
              category: 'goal',
              key: 'pilot_validation',
              value: 'Validate first value in one session',
            },
          ],
          exchangeCount: 3,
        },
      },
    ])
  })
})

describe('ListSessionEventsUseCase — limits and errors', () => {
  it('uses default limit and clamps oversized limits', async () => {
    const { useCase, findBySessionIdMock } = createUseCase()

    await useCase.execute({ sessionId: 'session_1' })
    await useCase.execute({ sessionId: 'session_1', limit: 999 })

    expect(findBySessionIdMock).toHaveBeenNthCalledWith(1, 'session_1', { limit: 50 })
    expect(findBySessionIdMock).toHaveBeenNthCalledWith(2, 'session_1', { limit: 200 })
  })

  it('throws NOT_FOUND when the session does not exist', async () => {
    const { useCase } = createUseCase({ session: null })

    await expect(useCase.execute({ sessionId: 'session_missing' })).rejects.toEqual(
      new DomainError('NOT_FOUND', 'Session session_missing was not found.'),
    )
  })
})
