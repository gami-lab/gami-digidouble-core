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
      triggerReason: 'turn_threshold',
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

describe('ListSessionEventsUseCase', () => {
  it('returns safe GM events and excludes non-GM event types', async () => {
    const { useCase } = createUseCase({
      events: [
        makeEvent({ type: 'system_internal', correlationId: 'corr_internal' }),
        makeEvent(),
        makeEvent({
          type: 'gm_skipped',
          correlationId: 'corr_2',
          createdAt: '2026-04-28T10:04:00.000Z',
          payload: {
            triggerReason: null,
            turnIndex: 4,
            interactionCount: 4,
            stateBefore: { progression: 'intro', topicsCovered: [] },
            latencyMs: 3,
          },
        }),
      ],
    })

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.events.map((event) => event.type)).toEqual(['gm_triggered', 'gm_skipped'])
    expect(output.events[0]).toEqual({
      type: 'gm_triggered',
      correlationId: 'corr_1',
      createdAt: '2026-04-28T10:05:00.000Z',
      payload: {
        triggerReason: 'turn_threshold',
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
