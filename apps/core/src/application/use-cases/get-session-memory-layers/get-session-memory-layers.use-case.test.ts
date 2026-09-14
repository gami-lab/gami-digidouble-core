import { describe, expect, it, vi } from 'vitest'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { GetSessionMemoryLayersUseCase } from './get-session-memory-layers.use-case.js'

function makeSession(): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-06-01T10:00:00.000Z',
    lastActivityAt: '2026-06-01T10:00:00.000Z',
  }
}

function makeConversation(): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-06-01T10:00:00.000Z',
    lastActivityAt: '2026-06-01T10:10:00.000Z',
  }
}

function message(
  role: Message['role'],
  content: string,
  createdAt: string,
): Pick<Message, 'role' | 'content' | 'createdAt'> {
  return { role, content, createdAt }
}

describe('GetSessionMemoryLayersUseCase', () => {
  it('returns a bounded, ordered short-term memory projection of complete exchanges', async () => {
    const sessionRepository = {
      findById: vi.fn().mockResolvedValue(makeSession()),
    } as unknown as ISessionRepository
    const conversationRepository = {
      findActiveBySessionId: vi.fn().mockResolvedValue(makeConversation()),
    } as unknown as IConversationRepository
    const messageRepository = {
      findByConversationId: vi
        .fn()
        .mockResolvedValue([
          message('avatar', 'orphaned answer', '2026-06-01T10:00:00.000Z'),
          message('avatar', 'answer 3', '2026-06-01T10:03:01.000Z'),
          message('user', '', '2026-06-01T10:03:00.000Z'),
          message('user', 'question 1', '2026-06-01T10:01:00.000Z'),
          message('avatar', 'answer 1', '2026-06-01T10:01:01.000Z'),
          message('user', 'question 2', '2026-06-01T10:02:00.000Z'),
          message('avatar', 'answer 2', '2026-06-01T10:02:01.000Z'),
          message('user', 'pending question', '2026-06-01T10:04:00.000Z'),
        ]),
    } as unknown as IMessageRepository

    const output = await new GetSessionMemoryLayersUseCase(
      sessionRepository,
      undefined,
      conversationRepository,
      messageRepository,
    ).execute({ sessionId: 'session_1' })

    expect(output.memory).toMatchObject({
      sessionId: 'session_1',
      activeConversationId: 'conversation_1',
      shortTerm: {
        exchangeCount: 3,
        recentExchanges: [
          { user: 'question 1', avatar: 'answer 1' },
          { user: 'question 2', avatar: 'answer 2' },
          { user: '', avatar: 'answer 3' },
        ],
      },
    })
  })

  it('returns a not-found failure for an unknown session', async () => {
    const sessionRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ISessionRepository

    await expect(
      new GetSessionMemoryLayersUseCase(sessionRepository).execute({ sessionId: 'missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
