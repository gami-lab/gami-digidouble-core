import { describe, expect, it } from 'vitest'
import { DomainError } from '../../../domain/errors.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { GetSessionContextUseCase } from './get-session-context.use-case.js'

function createUseCase() {
  return new GetSessionContextUseCase(
    new InMemorySessionRepository([makeSession()]),
    new InMemoryConversationRepository([makeConversation()]),
    new InMemoryAvatarRepository([makeAvatar()]),
    new InMemoryScenarioRepository([makeScenario()]),
    new InMemoryMessageRepository(makeMessages()),
    new InMemoryConversationWorkingMemoryRepository([makeWorkingMemory()]),
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

function makeAvatar() {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Guide',
    status: 'active' as const,
    personaPrompt: 'You are a guide.',
    description: 'General guide',
    config: {},
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }
}

function makeScenario() {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario One',
    status: 'active' as const,
    objectives: ['Obj1'],
    worldContext: 'Scenario world',
    avatarAvailability: { initialAvatarIds: [] },
    config: {
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
      content: 'q1',
      createdAt: '2026-05-01T10:01:00.000Z',
    },
    {
      messageId: 'msg_2',
      conversationId: 'conversation_1',
      role: 'avatar' as const,
      content: 'a1',
      createdAt: '2026-05-01T10:01:01.000Z',
    },
    {
      messageId: 'msg_3',
      conversationId: 'conversation_1',
      role: 'user' as const,
      content: 'q2',
      createdAt: '2026-05-01T10:02:00.000Z',
    },
    {
      messageId: 'msg_4',
      conversationId: 'conversation_1',
      role: 'avatar' as const,
      content: 'a2',
      createdAt: '2026-05-01T10:02:01.000Z',
    },
  ]
}

function makeWorkingMemory() {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    summary: 'Working summary',
    unresolvedThreads: ['thread_1'],
    candidateFacts: [],
    updatedAt: '2026-05-01T10:01:30.000Z',
  }
}

describe('GetSessionContextUseCase', () => {
  it('returns the stable prompt inputs without reassembling retrieval context', async () => {
    const output = await createUseCase().execute({ sessionId: 'session_1' })

    expect(output).toEqual({
      sessionId: 'session_1',
      avatarPrompt: 'You are a guide.',
      worldContext: 'Scenario world',
      worldObjectives: ['Obj1', 'Goal1'],
      gmInstruction: 'Focus on actionable steps.',
      workingMemory: {
        summary: 'Working summary',
        unresolvedThreads: ['thread_1'],
        updatedAt: '2026-05-01T10:01:30.000Z',
      },
      currentExchanges: [{ user: 'q2', avatar: 'a2' }],
    })
  })

  it('returns all exchanges when no working memory exists', async () => {
    const useCase = new GetSessionContextUseCase(
      new InMemorySessionRepository([makeSession()]),
      new InMemoryConversationRepository([makeConversation()]),
      new InMemoryAvatarRepository([makeAvatar()]),
      new InMemoryScenarioRepository([makeScenario()]),
      new InMemoryMessageRepository(makeMessages()),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.workingMemory).toBeNull()
    expect(output.currentExchanges).toEqual([
      { user: 'q1', avatar: 'a1' },
      { user: 'q2', avatar: 'a2' },
    ])
  })

  it('throws not found for an unknown session', async () => {
    const useCase = new GetSessionContextUseCase(
      new InMemorySessionRepository([]),
      new InMemoryConversationRepository([]),
      new InMemoryAvatarRepository([]),
      new InMemoryScenarioRepository([]),
      new InMemoryMessageRepository([]),
    )

    await expect(useCase.execute({ sessionId: 'missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<DomainError>)
  })
})
