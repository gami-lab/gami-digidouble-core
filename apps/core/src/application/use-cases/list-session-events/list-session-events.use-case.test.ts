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
      decision: {
        avatarId: 'avatar_2',
        conversationMode: 'new',
        notesInjected: true,
        directiveCount: 1,
      },
      stateAfter: {
        currentAvatarId: 'avatar_2',
        progression: 'advanced',
        topicsCovered: ['setup', 'handoff'],
      },
      latencyMs: 12,
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

describe('ListSessionEventsUseCase', () => {
  it('includes only gm_triggered and gm_error types; excludes system_internal', async () => {
    const { useCase } = createUseCase({
      events: [
        makeEvent({ type: 'system_internal', correlationId: 'corr_internal' }),
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

    expect(output.events.map((event) => event.type)).toEqual(['gm_triggered', 'gm_error'])
  })

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
        decision: {
          avatarId: 'avatar_2',
          conversationMode: 'new',
          notesInjected: true,
          directiveCount: 1,
        },
        stateAfter: {
          currentAvatarId: 'avatar_2',
          progression: 'advanced',
          topicsCovered: ['setup', 'handoff'],
        },
        latencyMs: 12,
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
