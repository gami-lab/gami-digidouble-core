import { describe, expect, it } from 'vitest'
import { DomainError } from '../../../domain/errors.js'
import { AvatarMemoryContextAssembler } from '../../services/avatar-memory-context-assembler.service.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryGmStateRepository } from '../../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { InMemoryUserRepository } from '../../../infrastructure/db/in-memory-user.repository.js'
import { InMemorySessionMemoryRepository } from '../../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemoryAvatarSessionMemoryRepository } from '../../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { GetSessionContextUseCase } from './get-session-context.use-case.js'

function createUseCase() {
  const sessionRepository = new InMemorySessionRepository([makeSession()])
  const conversationRepository = new InMemoryConversationRepository([makeConversation()])
  const avatarRepository = new InMemoryAvatarRepository(makeAvatars())
  const scenarioRepository = new InMemoryScenarioRepository([makeScenario()])
  const messageRepository = new InMemoryMessageRepository(makeMessages())
  const gmStateRepository = new InMemoryGmStateRepository([makeGmState()])
  const userRepository = new InMemoryUserRepository([makeUser()])
  const sessionMemoryRepository = new InMemorySessionMemoryRepository([makeSessionMemory()])
  const avatarSessionMemoryRepository = new InMemoryAvatarSessionMemoryRepository([
    makeAvatarMemory(),
  ])
  const userMemoryFactRepository = new InMemoryUserMemoryFactRepository([makeFact()])

  const memoryAssembler = new AvatarMemoryContextAssembler(
    messageRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    userMemoryFactRepository,
  )

  return new GetSessionContextUseCase(
    sessionRepository,
    conversationRepository,
    avatarRepository,
    scenarioRepository,
    messageRepository,
    gmStateRepository,
    userRepository,
    memoryAssembler,
  )
}

function makeSession() {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    unlockedAvatarIds: ['avatar_1'],
    gmNotes: 'Focus on actionable steps.',
    status: 'active' as const,
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:10:00.000Z',
  }
}

function makeConversation() {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active' as const,
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:10:00.000Z',
  }
}

function makeAvatars() {
  return [
    {
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      name: 'Guide',
      status: 'active' as const,
      personaPrompt: 'You are a guide.',
      description: 'General guide',
      config: {},
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    },
    {
      avatarId: 'avatar_2',
      scenarioId: 'scenario_1',
      name: 'Specialist',
      status: 'active' as const,
      personaPrompt: 'You are a specialist.',
      description: 'Expert guide',
      config: {},
      createdAt: '2026-05-01T10:00:01.000Z',
      updatedAt: '2026-05-01T10:00:01.000Z',
    },
  ]
}

function makeScenario() {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario One',
    status: 'active' as const,
    config: {
      worldContext: 'Scenario world',
      objectives: ['Obj1'],
      goals: ['Goal1'],
    },
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }
}

function makeMessages() {
  return [
    {
      messageId: 'msg_1',
      conversationId: 'conversation_1',
      role: 'user' as const,
      content: 'u1',
      createdAt: '2026-05-01T10:01:00.000Z',
    },
    {
      messageId: 'msg_2',
      conversationId: 'conversation_1',
      role: 'avatar' as const,
      content: 'a1',
      createdAt: '2026-05-01T10:01:01.000Z',
    },
  ]
}

function makeGmState() {
  return {
    sessionId: 'session_1',
    state: {
      currentAvatarId: 'avatar_1',
      progression: 'intro',
      topicsCovered: ['setup'],
      interactionCount: 2,
    },
  }
}

function makeUser() {
  return {
    userId: 'user_1',
    persona: { name: 'Maya', roleInWorld: 'student' },
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }
}

function makeSessionMemory() {
  return {
    sessionId: 'session_1',
    summary: 'Session summary',
    updatedAt: '2026-05-01T10:09:00.000Z',
  }
}

function makeAvatarMemory() {
  return {
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    summary: 'Avatar summary',
    updatedAt: '2026-05-01T10:08:00.000Z',
  }
}

function makeFact() {
  return {
    id: 'umf_1',
    userId: 'user_1',
    category: 'preference',
    key: 'style',
    value: 'concise',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }
}

describe('GetSessionContextUseCase', () => {
  it('returns bounded avatar and gm context snapshot', async () => {
    const useCase = createUseCase()
    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.sessionId).toBe('session_1')
    expect(output.avatarContext.avatarId).toBe('avatar_1')
    expect(output.avatarContext.recentExchanges).toEqual([{ user: 'u1', avatar: 'a1' }])
    expect(output.avatarContext.workingMemory.session?.summary).toBe('Session summary')
    expect(output.avatarContext.workingMemory.avatar?.summary).toBe('Avatar summary')
    expect(output.avatarContext.longTermFacts).toEqual([
      { category: 'preference', key: 'style', value: 'concise' },
    ])
    expect(output.avatarContext.userPersona).toEqual({ name: 'Maya', roleInWorld: 'student' })
    expect(output.gmContext.currentState.progression).toBe('intro')
    expect(output.gmContext.availableAvatars.length).toBe(2)
    expect(output.gmContext.memory.shortTerm?.recentExchanges).toEqual([
      { user: 'u1', avatar: 'a1' },
    ])
    expect(output.gmContext.memory.workingSummary).toContain('Session summary')
    expect(output.gmContext.memory.workingSummary).toContain('Avatar (avatar_1): Avatar summary')
    expect(output.gmContext.memory.longTermFacts).toEqual([
      { category: 'preference', key: 'style', value: 'concise' },
    ])
  })

  it('returns null/empty optional layers when conversation and persona are absent', async () => {
    const useCase = new GetSessionContextUseCase(
      new InMemorySessionRepository([
        {
          sessionId: 'session_2',
          userId: 'user_2',
          scenarioId: 'scenario_2',
          status: 'active',
          startedAt: '2026-05-01T10:00:00.000Z',
          lastActivityAt: '2026-05-01T10:10:00.000Z',
        },
      ]),
      new InMemoryConversationRepository([]),
      new InMemoryAvatarRepository([]),
      new InMemoryScenarioRepository([]),
      new InMemoryMessageRepository([]),
      new InMemoryGmStateRepository([]),
      new InMemoryUserRepository([]),
      undefined,
    )

    const output = await useCase.execute({ sessionId: 'session_2' })
    expect(output.avatarContext.avatarId).toBeUndefined()
    expect(output.avatarContext.recentExchanges).toEqual([])
    expect(output.avatarContext.longTermFacts).toEqual([])
    expect(output.avatarContext.userPersona).toBeNull()
    expect(output.gmContext.recentMessages).toEqual([])
    expect(output.gmContext.currentState).toEqual({
      progression: '',
      topicsCovered: [],
      interactionCount: 0,
    })
    expect(output.gmContext.memory).toEqual({})
  })

  it('throws NOT_FOUND when session is missing', async () => {
    const useCase = new GetSessionContextUseCase(
      new InMemorySessionRepository([]),
      new InMemoryConversationRepository([]),
      new InMemoryAvatarRepository([]),
      new InMemoryScenarioRepository([]),
      new InMemoryMessageRepository([]),
      new InMemoryGmStateRepository([]),
    )

    await expect(useCase.execute({ sessionId: 'missing' })).rejects.toEqual(
      new DomainError('NOT_FOUND', 'Session missing was not found.'),
    )
  })
})
