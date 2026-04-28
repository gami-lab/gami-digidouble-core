import { describe, expect, it } from 'vitest'
import type { Session } from '../../../domain/conversation/session.types.js'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
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

describe('ResetSessionUseCase', () => {
  it('throws NOT_FOUND when session does not exist', async () => {
    const useCase = new ResetSessionUseCase(
      new InMemorySessionRepository(),
      new InMemoryConversationRepository(),
      new InMemoryMessageRepository(),
    )

    await expect(useCase.execute({ sessionId: 'session_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('resets session state fields and returns updated session', async () => {
    const sessionRepository = new InMemorySessionRepository([
      makeSession({
        sessionId: 'session_1',
        activeAvatarId: 'avatar_1',
        unlockedAvatarIds: ['avatar_1', 'avatar_2'],
        gmNotes: 'Some GM notes',
        status: 'closed',
      }),
    ])
    const useCase = new ResetSessionUseCase(
      sessionRepository,
      new InMemoryConversationRepository(),
      new InMemoryMessageRepository(),
    )

    const result = await useCase.execute({ sessionId: 'session_1' })

    expect(result.session.status).toBe('active')
    expect(result.session.activeAvatarId).toBeUndefined()
    expect(result.session.unlockedAvatarIds).toEqual([])
    expect(result.session.gmNotes).toBeUndefined()
  })

  it('deletes all conversations and messages for the session', async () => {
    const sessionRepository = new InMemorySessionRepository([
      makeSession({ sessionId: 'session_1' }),
    ])
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
    const useCase = new ResetSessionUseCase(
      sessionRepository,
      conversationRepository,
      messageRepository,
    )

    await useCase.execute({ sessionId: 'session_1' })

    const conversations = await conversationRepository.listBySessionId('session_1')
    expect(conversations).toEqual([])

    const messages = await messageRepository.findByConversationId('conversation_1')
    expect(messages).toEqual([])
  })

  it('refreshes lastActivityAt to a recent timestamp', async () => {
    const beforeReset = new Date().toISOString()
    const sessionRepository = new InMemorySessionRepository([
      makeSession({
        sessionId: 'session_1',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
      }),
    ])
    const useCase = new ResetSessionUseCase(
      sessionRepository,
      new InMemoryConversationRepository(),
      new InMemoryMessageRepository(),
    )

    const result = await useCase.execute({ sessionId: 'session_1' })

    expect(result.session.lastActivityAt >= beforeReset).toBe(true)
  })
})
