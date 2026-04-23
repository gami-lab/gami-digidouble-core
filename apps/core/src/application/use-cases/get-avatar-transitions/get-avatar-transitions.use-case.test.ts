import { describe, expect, it } from 'vitest'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { GetAvatarTransitionsUseCase } from './get-avatar-transitions.use-case.js'

describe('GetAvatarTransitionsUseCase', () => {
  it('returns NOT_FOUND when session does not exist', async () => {
    const useCase = new GetAvatarTransitionsUseCase(
      new InMemorySessionRepository(),
      new InMemoryConversationRepository(),
    )

    await expect(useCase.execute({ sessionId: 'session_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('returns empty transitions when session has no conversations', async () => {
    const useCase = new GetAvatarTransitionsUseCase(
      new InMemorySessionRepository([
        {
          sessionId: 'session_1',
          userId: 'user_1',
          scenarioId: 'scenario_1',
          status: 'active',
          startedAt: '2026-04-23T10:00:00.000Z',
          lastActivityAt: '2026-04-23T10:01:00.000Z',
        },
      ]),
      new InMemoryConversationRepository(),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output).toEqual({
      sessionId: 'session_1',
      transitions: [],
    })
  })
})

describe('GetAvatarTransitionsUseCase transition mapping', () => {
  it('returns session_start and manual switch transition records in order', async () => {
    const useCase = new GetAvatarTransitionsUseCase(
      new InMemorySessionRepository([
        {
          sessionId: 'session_1',
          userId: 'user_1',
          scenarioId: 'scenario_1',
          status: 'active',
          startedAt: '2026-04-23T10:00:00.000Z',
          lastActivityAt: '2026-04-23T10:01:00.000Z',
        },
      ]),
      new InMemoryConversationRepository([
        {
          conversationId: 'conversation_1',
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          status: 'closed',
          startedAt: '2026-04-23T10:00:00.000Z',
          lastActivityAt: '2026-04-23T10:00:00.000Z',
          startedBy: 'user',
        },
        {
          conversationId: 'conversation_2',
          sessionId: 'session_1',
          avatarId: 'avatar_2',
          status: 'active',
          startedAt: '2026-04-23T10:05:00.000Z',
          lastActivityAt: '2026-04-23T10:05:00.000Z',
          startedBy: 'user',
          reason: 'manual_switch',
          handoffFromConversationId: 'conversation_1',
        },
      ]),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.transitions).toEqual([
      {
        toConversationId: 'conversation_1',
        toAvatarId: 'avatar_1',
        fromConversationId: null,
        fromAvatarId: null,
        reason: 'session_start',
        startedBy: 'user',
        transitionedAt: '2026-04-23T10:00:00.000Z',
      },
      {
        toConversationId: 'conversation_2',
        toAvatarId: 'avatar_2',
        fromConversationId: 'conversation_1',
        fromAvatarId: 'avatar_1',
        reason: 'manual_switch',
        startedBy: 'user',
        transitionedAt: '2026-04-23T10:05:00.000Z',
      },
    ])
  })

  it('sets fromAvatarId null when handoff source is missing', async () => {
    const useCase = new GetAvatarTransitionsUseCase(
      new InMemorySessionRepository([
        {
          sessionId: 'session_1',
          userId: 'user_1',
          scenarioId: 'scenario_1',
          status: 'active',
          startedAt: '2026-04-23T10:00:00.000Z',
          lastActivityAt: '2026-04-23T10:01:00.000Z',
        },
      ]),
      new InMemoryConversationRepository([
        {
          conversationId: 'conversation_2',
          sessionId: 'session_1',
          avatarId: 'avatar_2',
          status: 'active',
          startedAt: '2026-04-23T10:05:00.000Z',
          lastActivityAt: '2026-04-23T10:05:00.000Z',
          handoffFromConversationId: 'conversation_missing',
        },
      ]),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.transitions[0]).toEqual({
      toConversationId: 'conversation_2',
      toAvatarId: 'avatar_2',
      fromConversationId: 'conversation_missing',
      fromAvatarId: null,
      reason: null,
      startedBy: null,
      transitionedAt: '2026-04-23T10:05:00.000Z',
    })
  })
})
