import { describe, expect, it, vi } from 'vitest'
import type { RuntimeEvent } from '@gami/shared'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { ISessionEventPublisher } from '../../ports/ISessionEventPublisher.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { GetRuntimeStateUseCase } from './get-runtime-state.use-case.js'

function buildSessionRepository(
  findById: ISessionRepository['findById'],
): Pick<ISessionRepository, 'findById'> {
  return { findById }
}

function buildConversationRepository(
  findActiveBySessionId: IConversationRepository['findActiveBySessionId'],
): Pick<IConversationRepository, 'findActiveBySessionId'> {
  return { findActiveBySessionId }
}

function buildEventPublisher(
  overrides: Partial<ISessionEventPublisher> = {},
): ISessionEventPublisher {
  return {
    emit: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    getLastEvent: vi.fn(() => undefined),
    isProcessing: vi.fn(() => false),
    setProcessing: vi.fn(),
    ...overrides,
  }
}

const baseSession = {
  sessionId: 'session_1',
  userId: 'user_1',
  scenarioId: 'scenario_1',
  activeAvatarId: 'avatar_1',
  status: 'active' as const,
  startedAt: '2026-05-01T10:00:00.000Z',
  lastActivityAt: '2026-05-01T10:00:00.000Z',
}

const activeConversation = {
  conversationId: 'conversation_1',
  sessionId: 'session_1',
  avatarId: 'avatar_1',
  status: 'active' as const,
  startedAt: '2026-05-01T10:05:00.000Z',
  lastActivityAt: '2026-05-01T10:05:00.000Z',
}

describe('GetRuntimeStateUseCase message acceptance and processing', () => {
  it('throws NOT_FOUND when session does not exist', async () => {
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(null)) as ISessionRepository,
      buildConversationRepository(() => Promise.resolve(null)) as IConversationRepository,
      buildEventPublisher(),
    )

    await expect(useCase.execute({ sessionId: 'missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('returns canSendMessage=true for active session with active conversation', async () => {
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(baseSession)) as ISessionRepository,
      buildConversationRepository(() =>
        Promise.resolve(activeConversation),
      ) as IConversationRepository,
      buildEventPublisher(),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState.canSendMessage).toBe(true)
  })

  it('returns canSendMessage=false for active session with no active conversation', async () => {
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(baseSession)) as ISessionRepository,
      buildConversationRepository(() => Promise.resolve(null)) as IConversationRepository,
      buildEventPublisher(),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState.canSendMessage).toBe(false)
  })

  it('returns canSendMessage=false when session has no activeAvatarId', async () => {
    const sessionWithoutAvatar = {
      sessionId: baseSession.sessionId,
      userId: baseSession.userId,
      scenarioId: baseSession.scenarioId,
      status: baseSession.status,
      startedAt: baseSession.startedAt,
      lastActivityAt: baseSession.lastActivityAt,
    }
    const findActiveSpy = vi.fn()
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(sessionWithoutAvatar)) as ISessionRepository,
      buildConversationRepository(findActiveSpy) as IConversationRepository,
      buildEventPublisher(),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState.canSendMessage).toBe(false)
    expect(findActiveSpy).not.toHaveBeenCalled()
  })

  it('returns canSendMessage=false for closed session', async () => {
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() =>
        Promise.resolve({ ...baseSession, status: 'closed' as const }),
      ) as ISessionRepository,
      buildConversationRepository(() =>
        Promise.resolve(activeConversation),
      ) as IConversationRepository,
      buildEventPublisher(),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState.canSendMessage).toBe(false)
  })

  it('returns isProcessing=true when publisher reports processing', async () => {
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(baseSession)) as ISessionRepository,
      buildConversationRepository(() =>
        Promise.resolve(activeConversation),
      ) as IConversationRepository,
      buildEventPublisher({ isProcessing: vi.fn(() => true) }),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState.isProcessing).toBe(true)
  })

  it('returns isProcessing=false when publisher reports not processing', async () => {
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(baseSession)) as ISessionRepository,
      buildConversationRepository(() =>
        Promise.resolve(activeConversation),
      ) as IConversationRepository,
      buildEventPublisher({ isProcessing: vi.fn(() => false) }),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState.isProcessing).toBe(false)
  })
})

describe('GetRuntimeStateUseCase pending event and conversation metadata', () => {
  it('returns pendingEvent when publisher has last event', async () => {
    const pendingEvent: RuntimeEvent = {
      eventId: 'evt_1',
      sessionId: 'session_1',
      type: 'runtime.avatar_unlocked',
      occurredAt: '2026-05-01T10:06:00.000Z',
      payload: { avatarId: 'avatar_2' },
    }

    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(baseSession)) as ISessionRepository,
      buildConversationRepository(() =>
        Promise.resolve(activeConversation),
      ) as IConversationRepository,
      buildEventPublisher({ getLastEvent: vi.fn(() => pendingEvent) }),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState.pendingEvent).toEqual(pendingEvent)
  })

  it('omits pendingEvent when no event is available', async () => {
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(baseSession)) as ISessionRepository,
      buildConversationRepository(() =>
        Promise.resolve(activeConversation),
      ) as IConversationRepository,
      buildEventPublisher({ getLastEvent: vi.fn(() => undefined) }),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState).not.toHaveProperty('pendingEvent')
  })

  it('returns conversationId when active conversation exists', async () => {
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(baseSession)) as ISessionRepository,
      buildConversationRepository(() =>
        Promise.resolve(activeConversation),
      ) as IConversationRepository,
      buildEventPublisher(),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState.conversationId).toBe('conversation_1')
  })

  it('returns undefined conversationId when no active conversation exists', async () => {
    const useCase = new GetRuntimeStateUseCase(
      buildSessionRepository(() => Promise.resolve(baseSession)) as ISessionRepository,
      buildConversationRepository(() => Promise.resolve(null)) as IConversationRepository,
      buildEventPublisher(),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.runtimeState.conversationId).toBeUndefined()
  })
})
