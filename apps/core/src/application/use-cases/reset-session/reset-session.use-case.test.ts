import { describe, expect, it } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
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
    config: {
      avatarAvailability: {
        initialAvatarIds: [],
      },
    },
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

function makeUseCase({
  sessions = [],
  scenarios = [makeScenario()],
  avatars = [],
  conversationRepository = new InMemoryConversationRepository(),
  messageRepository = new InMemoryMessageRepository(),
}: {
  sessions?: Session[]
  scenarios?: Scenario[]
  avatars?: AvatarConfig[]
  conversationRepository?: InMemoryConversationRepository
  messageRepository?: InMemoryMessageRepository
} = {}): ResetSessionUseCase {
  return new ResetSessionUseCase(
    new InMemorySessionRepository(sessions),
    new InMemoryScenarioRepository(scenarios),
    new InMemoryAvatarRepository(avatars),
    conversationRepository,
    messageRepository,
  )
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
          config: {
            avatarAvailability: {
              initialAvatarIds: ['avatar_guide'],
            },
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
