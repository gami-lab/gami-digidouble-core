import { describe, expect, it, vi } from 'vitest'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { Conversation, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import { InspectSessionUseCase } from './inspect-session.use-case.js'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_2',
    unlockedAvatarIds: ['avatar_1', 'avatar_2'],
    gmNotes: 'Guide the next turn toward reflection.',
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

function createRepositories(params?: {
  session?: Session | null
  gmState?: Awaited<ReturnType<IGmStateRepository['findBySessionId']>>
  conversations?: Conversation[]
}): {
  sessionRepository: ISessionRepository
  gmStateRepository: IGmStateRepository
  conversationRepository: IConversationRepository
} {
  const gmState = Object.hasOwn(params ?? {}, 'gmState')
    ? params?.gmState
    : {
        currentAvatarId: 'avatar_2',
        progression: 'intro complete',
        topicsCovered: ['setup'],
        interactionCount: 4,
      }
  const session = Object.hasOwn(params ?? {}, 'session') ? params?.session : makeSession()

  return {
    sessionRepository: {
      findById: vi.fn().mockResolvedValue(session),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      countByScenarioId: vi.fn(),
      countActiveByScenarioId: vi.fn(),
    },
    gmStateRepository: {
      findBySessionId: vi.fn().mockResolvedValue(gmState),
      save: vi.fn(),
    },
    conversationRepository: {
      findById: vi.fn(),
      findActiveBySessionId: vi.fn(),
      create: vi.fn(),
      listBySessionId: vi.fn().mockResolvedValue(params?.conversations ?? []),
      deleteBySessionId: vi.fn(),
      update: vi.fn(),
    },
  }
}

describe('InspectSessionUseCase', () => {
  it('returns an admin-safe session orchestration snapshot', async () => {
    const repositories = createRepositories({
      conversations: [
        makeConversation({
          conversationId: 'conversation_1',
          avatarId: 'avatar_1',
          startedBy: 'user',
          reason: 'session_start',
          startedAt: '2026-04-28T10:00:00.000Z',
        }),
        makeConversation({
          conversationId: 'conversation_2',
          avatarId: 'avatar_2',
          startedBy: 'gm',
          reason: 'turn_threshold',
          startedAt: '2026-04-28T10:04:00.000Z',
        }),
      ],
    })
    const useCase = new InspectSessionUseCase(
      repositories.sessionRepository,
      repositories.gmStateRepository,
      repositories.conversationRepository,
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.inspect.session).toEqual({
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      activeAvatarId: 'avatar_2',
      unlockedAvatarIds: ['avatar_1', 'avatar_2'],
      status: 'active',
      startedAt: '2026-04-28T10:00:00.000Z',
      lastActivityAt: '2026-04-28T10:05:00.000Z',
    })
    expect(output.inspect.gmState).toEqual({
      currentAvatarId: 'avatar_2',
      progression: 'intro complete',
      topicsCovered: ['setup'],
      interactionCount: 4,
    })
    expect(output.inspect.unlockedAvatarIds).toEqual(['avatar_1', 'avatar_2'])
    expect(output.inspect.gmNotes).toBe('Guide the next turn toward reflection.')
    expect(output.inspect.transitionHistory).toEqual([
      {
        fromAvatarId: 'avatar_1',
        toAvatarId: 'avatar_2',
        reason: 'turn_threshold',
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
  })

  it('returns null gmState, empty unlocks, and null gmNotes for fresh sessions', async () => {
    const repositories = createRepositories({
      session: {
        sessionId: 'session_1',
        userId: 'user_1',
        scenarioId: 'scenario_1',
        status: 'active',
        startedAt: '2026-04-28T10:00:00.000Z',
        lastActivityAt: '2026-04-28T10:05:00.000Z',
      },
      gmState: null,
    })
    const useCase = new InspectSessionUseCase(
      repositories.sessionRepository,
      repositories.gmStateRepository,
      repositories.conversationRepository,
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.inspect.gmState).toBeNull()
    expect(output.inspect.unlockedAvatarIds).toEqual([])
    expect(output.inspect.gmNotes).toBeNull()
  })

  it('throws NOT_FOUND when the session does not exist', async () => {
    const repositories = createRepositories({ session: null })
    const useCase = new InspectSessionUseCase(
      repositories.sessionRepository,
      repositories.gmStateRepository,
      repositories.conversationRepository,
    )

    await expect(useCase.execute({ sessionId: 'session_missing' })).rejects.toEqual(
      new DomainError('NOT_FOUND', 'Session session_missing was not found.'),
    )
  })
})
