import { describe, expect, it } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryConversationMemoryRepository } from '../../../infrastructure/db/in-memory-conversation-memory.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { InMemorySessionMemoryRepository } from '../../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemoryAvatarSessionMemoryRepository } from '../../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { ResetSessionUseCase } from './reset-session.use-case.js'

function makeSession(overrides: Partial<Session> & Pick<Session, 'sessionId'>): Session {
  return {
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-21T08:00:00.000Z',
    lastActivityAt: '2026-04-21T08:00:00.000Z',
    ...overrides,
  }
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario 1',
    status: 'active',
    objectives: [],
    worldContext: '',
    // Non-empty so the availability policy is treated as configured (deterministic
    // empty result once filtered against the test's avatar roster), rather than
    // "no policy" (which would leave unlockedAvatarIds untouched on reset).
    avatarAvailability: {
      initialAvatarIds: ['avatar_unregistered'],
    },
    config: {},
    createdAt: '2026-04-21T08:00:00.000Z',
    updatedAt: '2026-04-21T08:00:00.000Z',
    ...overrides,
  }
}

function makeAvatar({
  avatarId,
  ...overrides
}: Partial<AvatarConfig> & Pick<AvatarConfig, 'avatarId'>): AvatarConfig {
  return {
    avatarId,
    scenarioId: 'scenario_1',
    name: 'Guide',
    status: 'active',
    personaPrompt: 'Guide persona',
    config: {},
    createdAt: '2026-04-21T08:00:00.000Z',
    updatedAt: '2026-04-21T08:00:00.000Z',
    ...overrides,
  }
}

type UseCaseFactoryOptions = {
  sessions?: Session[]
  scenarios?: Scenario[]
  avatars?: AvatarConfig[]
  conversationRepository?: InMemoryConversationRepository
  messageRepository?: InMemoryMessageRepository
  sessionMemoryRepository?: InMemorySessionMemoryRepository
  avatarSessionMemoryRepository?: InMemoryAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository?: InMemoryConversationWorkingMemoryRepository
  conversationMemoryRepository?: InMemoryConversationMemoryRepository
}

function makeUseCase(options: UseCaseFactoryOptions = {}): ResetSessionUseCase {
  const config = {
    sessions: [] as Session[],
    scenarios: [makeScenario()] as Scenario[],
    avatars: [] as AvatarConfig[],
    conversationRepository: new InMemoryConversationRepository(),
    messageRepository: new InMemoryMessageRepository(),
    sessionMemoryRepository: new InMemorySessionMemoryRepository(),
    avatarSessionMemoryRepository: new InMemoryAvatarSessionMemoryRepository(),
    ...options,
  }

  return new ResetSessionUseCase(
    new InMemorySessionRepository(config.sessions),
    new InMemoryScenarioRepository(config.scenarios),
    new InMemoryAvatarRepository(config.avatars),
    config.conversationRepository,
    config.messageRepository,
    config.sessionMemoryRepository,
    config.avatarSessionMemoryRepository,
    config.conversationWorkingMemoryRepository,
    config.conversationMemoryRepository,
  )
}

function makeSessionMemoryRepository() {
  return new InMemorySessionMemoryRepository([
    {
      sessionId: 'session_1',
      summary: 'Session one memory',
      updatedAt: '2026-04-21T08:00:00.000Z',
    },
    {
      sessionId: 'session_2',
      summary: 'Session two memory',
      updatedAt: '2026-04-21T08:00:00.000Z',
    },
  ])
}

function makeAvatarSessionMemoryRepository() {
  return new InMemoryAvatarSessionMemoryRepository([
    {
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Session one avatar one memory',
      updatedAt: '2026-04-21T08:00:00.000Z',
    },
    {
      sessionId: 'session_1',
      avatarId: 'avatar_2',
      summary: 'Session one avatar two memory',
      updatedAt: '2026-04-21T08:00:00.000Z',
    },
    {
      sessionId: 'session_2',
      avatarId: 'avatar_1',
      summary: 'Session two avatar one memory',
      updatedAt: '2026-04-21T08:00:00.000Z',
    },
  ])
}

async function expectSessionWorkingMemoryCleared(
  sessionMemoryRepository: InMemorySessionMemoryRepository,
  avatarSessionMemoryRepository: InMemoryAvatarSessionMemoryRepository,
) {
  await expect(sessionMemoryRepository.findBySessionId('session_1')).resolves.toBeNull()
  await expect(sessionMemoryRepository.findBySessionId('session_2')).resolves.toMatchObject({
    summary: 'Session two memory',
  })
  await expect(
    avatarSessionMemoryRepository.findBySessionIdAndAvatarId('session_1', 'avatar_1'),
  ).resolves.toBeNull()
  await expect(
    avatarSessionMemoryRepository.findBySessionIdAndAvatarId('session_1', 'avatar_2'),
  ).resolves.toBeNull()
  await expect(
    avatarSessionMemoryRepository.findBySessionIdAndAvatarId('session_2', 'avatar_1'),
  ).resolves.toMatchObject({ summary: 'Session two avatar one memory' })
}

function makeConversationWorkingMemoryRepository() {
  return new InMemoryConversationWorkingMemoryRepository([
    {
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Session one working memory',
      unresolvedThreads: ['thread-1'],
      candidateFacts: [],
      updatedAt: '2026-04-21T08:00:00.000Z',
    },
    {
      conversationId: 'conversation_2',
      sessionId: 'session_2',
      avatarId: 'avatar_1',
      summary: 'Session two working memory',
      unresolvedThreads: ['thread-2'],
      candidateFacts: [],
      updatedAt: '2026-04-21T08:00:00.000Z',
    },
  ])
}

function makeConversationMemoryRepository() {
  return new InMemoryConversationMemoryRepository([
    {
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      summary: 'Session one episodic memory',
      keyDiscoveries: [],
      unresolvedTopics: [],
      factCandidates: [],
      createdAt: '2026-04-21T08:00:00.000Z',
    },
    {
      conversationId: 'conversation_2',
      sessionId: 'session_2',
      userId: 'user_2',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      summary: 'Session two episodic memory',
      keyDiscoveries: [],
      unresolvedTopics: [],
      factCandidates: [],
      createdAt: '2026-04-21T08:00:00.000Z',
    },
  ])
}

async function expectConversationMemoryCleared(
  conversationWorkingMemoryRepository: InMemoryConversationWorkingMemoryRepository,
  conversationMemoryRepository: InMemoryConversationMemoryRepository,
) {
  await expect(
    conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
  ).resolves.toBeNull()
  await expect(
    conversationWorkingMemoryRepository.findByConversationId('conversation_2'),
  ).resolves.toMatchObject({ summary: 'Session two working memory' })
  await expect(
    conversationMemoryRepository.findByConversationId('conversation_1'),
  ).resolves.toBeNull()
  await expect(
    conversationMemoryRepository.findByConversationId('conversation_2'),
  ).resolves.toMatchObject({
    summary: 'Session two episodic memory',
  })
}

describe('ResetSessionUseCase baseline behavior', () => {
  it('throws NOT_FOUND when session does not exist', async () => {
    const useCase = makeUseCase()

    await expect(useCase.execute({ sessionId: 'session_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('resets session state fields and returns updated session', async () => {
    const useCase = makeUseCase({
      sessions: [
        makeSession({
          sessionId: 'session_1',
          activeAvatarId: 'avatar_1',
          unlockedAvatarIds: ['avatar_1', 'avatar_2'],
          gmNotes: 'Some GM notes',
          status: 'closed',
        }),
      ],
    })

    const result = await useCase.execute({ sessionId: 'session_1' })

    expect(result.session.status).toBe('active')
    expect(result.session.activeAvatarId).toBeUndefined()
    expect(result.session.unlockedAvatarIds).toEqual([])
    expect(result.session.gmNotes).toBeUndefined()
    expect(result.session.memorySummary).toBeUndefined()
  })

  it('deletes all conversations and messages for the session', async () => {
    const conversationRepository = new InMemoryConversationRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        status: 'active',
        startedAt: '2026-04-21T08:00:00.000Z',
        lastActivityAt: '2026-04-21T08:00:00.000Z',
      },
    ])
    const messageRepository = new InMemoryMessageRepository([
      {
        messageId: 'msg_1',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'Hello',
        createdAt: '2026-04-21T08:01:00.000Z',
      },
    ])
    const useCase = makeUseCase({
      sessions: [makeSession({ sessionId: 'session_1' })],
      conversationRepository,
      messageRepository,
    })

    await useCase.execute({ sessionId: 'session_1' })

    const conversations = await conversationRepository.listBySessionId('session_1')
    expect(conversations).toEqual([])

    const messages = await messageRepository.findByConversationId('conversation_1')
    expect(messages).toEqual([])
  })

  it('refreshes lastActivityAt to a recent timestamp', async () => {
    const beforeReset = new Date().toISOString()
    const useCase = makeUseCase({
      sessions: [
        makeSession({
          sessionId: 'session_1',
          lastActivityAt: '2026-01-01T00:00:00.000Z',
        }),
      ],
    })

    const result = await useCase.execute({ sessionId: 'session_1' })

    expect(result.session.lastActivityAt >= beforeReset).toBe(true)
  })

  it('throws NOT_FOUND when the session scenario does not exist', async () => {
    const useCase = makeUseCase({
      sessions: [makeSession({ sessionId: 'session_1', scenarioId: 'scenario_missing' })],
      scenarios: [],
    })

    await expect(useCase.execute({ sessionId: 'session_1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('ResetSessionUseCase unlock policy behavior', () => {
  it('restores initial unlocked avatars from scenario policy after reset', async () => {
    const useCase = makeUseCase({
      sessions: [
        makeSession({
          sessionId: 'session_1',
          scenarioId: 'scenario_policy',
          unlockedAvatarIds: ['avatar_guide', 'avatar_ethics'],
        }),
      ],
      scenarios: [
        makeScenario({
          scenarioId: 'scenario_policy',
          avatarAvailability: {
            initialAvatarIds: ['avatar_guide'],
          },
        }),
      ],
      avatars: [
        makeAvatar({
          avatarId: 'avatar_guide',
          scenarioId: 'scenario_policy',
        }),
        makeAvatar({
          avatarId: 'avatar_ethics',
          scenarioId: 'scenario_policy',
          name: 'Ethics',
          config: {},
        }),
      ],
    })

    const result = await useCase.execute({ sessionId: 'session_1' })

    expect(result.session.unlockedAvatarIds).toEqual(['avatar_guide'])
  })
})

describe('ResetSessionUseCase memory isolation', () => {
  it('clears session and avatar working memory for the reset session', async () => {
    const sessionMemoryRepository = makeSessionMemoryRepository()
    const avatarSessionMemoryRepository = makeAvatarSessionMemoryRepository()
    const useCase = makeUseCase({
      sessions: [makeSession({ sessionId: 'session_1' })],
      sessionMemoryRepository,
      avatarSessionMemoryRepository,
    })

    await useCase.execute({ sessionId: 'session_1' })

    await expectSessionWorkingMemoryCleared(sessionMemoryRepository, avatarSessionMemoryRepository)
  })

  it('clears conversation working memory and episodic memory for the reset session', async () => {
    const conversationWorkingMemoryRepository = makeConversationWorkingMemoryRepository()
    const conversationMemoryRepository = makeConversationMemoryRepository()
    const useCase = makeUseCase({
      sessions: [makeSession({ sessionId: 'session_1' })],
      conversationRepository: new InMemoryConversationRepository([
        {
          conversationId: 'conversation_1',
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          status: 'active',
          startedAt: '2026-04-21T08:00:00.000Z',
          lastActivityAt: '2026-04-21T08:00:00.000Z',
        },
        {
          conversationId: 'conversation_2',
          sessionId: 'session_2',
          avatarId: 'avatar_1',
          status: 'active',
          startedAt: '2026-04-21T08:00:00.000Z',
          lastActivityAt: '2026-04-21T08:00:00.000Z',
        },
      ]),
      conversationWorkingMemoryRepository,
      conversationMemoryRepository,
    })

    await useCase.execute({ sessionId: 'session_1' })

    await expectConversationMemoryCleared(
      conversationWorkingMemoryRepository,
      conversationMemoryRepository,
    )
  })

  it('does not delete cross-session user memory facts', async () => {
    const userMemoryFactRepository = new InMemoryUserMemoryFactRepository([
      {
        id: 'umf_1',
        userId: 'user_1',
        category: 'preference',
        key: 'language',
        value: 'English',
        confidence: 0.8,
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      },
    ])
    const useCase = makeUseCase({
      sessions: [makeSession({ sessionId: 'session_1', userId: 'user_1' })],
    })

    await useCase.execute({ sessionId: 'session_1' })

    const facts = await userMemoryFactRepository.findByUserId('user_1')
    expect(facts).toHaveLength(1)
    expect(facts[0]?.id).toBe('umf_1')
  })
})

describe('ResetSessionUseCase long-term memory preservation', () => {
  it('does not delete long-term user memory facts during reset', async () => {
    const userMemoryFactRepository = new InMemoryUserMemoryFactRepository([
      {
        id: 'umf_1',
        userId: 'user_1',
        category: 'preference',
        key: 'language',
        value: 'English',
        confidence: 0.9,
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      },
    ])
    const useCase = makeUseCase({
      sessions: [makeSession({ sessionId: 'session_1' })],
    })

    await useCase.execute({ sessionId: 'session_1' })

    await expect(userMemoryFactRepository.findByUserId('user_1')).resolves.toHaveLength(1)
  })
})
