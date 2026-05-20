import { describe, expect, it, vi } from 'vitest'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'
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
  avatarRepository: IAvatarRepository
  modelConfigRepository: IModelConfigRepository
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
    avatarRepository: {
      findById: vi.fn().mockResolvedValue({
        avatarId: 'avatar_2',
        scenarioId: 'scenario_1',
        name: 'Avatar',
        status: 'active',
        personaPrompt: 'Prompt',
        llmOverride: { provider: 'anthropic', model: 'claude-3-5-haiku' },
        config: {},
        createdAt: '2026-04-28T09:01:00.000Z',
        updatedAt: '2026-04-28T09:01:00.000Z',
      }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      listByScenarioId: vi.fn(),
    },
    modelConfigRepository: {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
        roleOverrides: {
          gameMaster: { provider: 'mistral', model: 'mistral-small-latest' },
          memory: { provider: 'xai', model: 'grok-2-mini' },
        },
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      upsert: vi.fn(),
    },
  }
}

function createUseCaseFromRepositories(params?: Parameters<typeof createRepositories>[0]) {
  const r = createRepositories(params)
  return new InspectSessionUseCase(
    r.sessionRepository,
    r.gmStateRepository,
    r.conversationRepository,
    r.avatarRepository,
    r.modelConfigRepository,
  )
}

const twoConversationParams = {
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
      reason: 'post_turn_observation',
      startedAt: '2026-04-28T10:04:00.000Z',
    }),
  ],
}

describe('InspectSessionUseCase', () => {
  it('returns session summary, gmState, unlocks, and notes', async () => {
    const useCase = createUseCaseFromRepositories(twoConversationParams)

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
    expect(output.inspect.effectiveModels).toEqual({
      avatar: { provider: 'anthropic', model: 'claude-3-5-haiku' },
      gameMaster: { provider: 'mistral', model: 'mistral-small-latest' },
      memory: { provider: 'xai', model: 'grok-2-mini' },
    })
    expect(output.inspect.transitionHistory).toEqual([
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
  })

  it('returns null gmState, empty unlocks, and null gmNotes for fresh sessions', async () => {
    const useCase = createUseCaseFromRepositories({
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

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.inspect.gmState).toBeNull()
    expect(output.inspect.unlockedAvatarIds).toEqual([])
    expect(output.inspect.gmNotes).toBeNull()
    expect(output.inspect.effectiveModels.avatar.provider).toBe('openai')
  })

  it('throws NOT_FOUND when the session does not exist', async () => {
    const useCase = createUseCaseFromRepositories({ session: null })

    await expect(useCase.execute({ sessionId: 'session_missing' })).rejects.toEqual(
      new DomainError('NOT_FOUND', 'Session session_missing was not found.'),
    )
  })

  it('includes endedAt in session summary when the session is closed', async () => {
    const useCase = createUseCaseFromRepositories({
      session: makeSession({ status: 'closed', endedAt: '2026-04-28T11:00:00.000Z' }),
      gmState: null,
    })

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.inspect.session.status).toBe('closed')
    expect(output.inspect.session.endedAt).toBe('2026-04-28T11:00:00.000Z')
  })
})
