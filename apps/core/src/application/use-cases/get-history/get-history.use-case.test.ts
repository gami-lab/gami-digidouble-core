import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation, Message } from '../../../domain/conversation/session.types.js'
import { GetHistoryUseCase } from './get-history.use-case.js'

const findConversationByIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()

const conversationRepository = {
  findById: findConversationByIdMock,
  findActiveBySessionId: vi.fn(),
  create: vi.fn(),
  listBySessionId: vi.fn(),
  update: vi.fn(),
}

const messageRepository = {
  findByConversationId: findMessagesByConversationIdMock,
  save: vi.fn(),
  deleteByConversationId: vi.fn(),
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-19T10:00:00.000Z',
    lastActivityAt: '2026-04-19T10:00:00.000Z',
    ...overrides,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    messageId: 'msg_1',
    conversationId: 'conversation_1',
    role: 'user',
    content: 'hello',
    createdAt: '2026-04-19T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  findConversationByIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  findConversationByIdMock.mockResolvedValue(makeConversation())
  findMessagesByConversationIdMock.mockResolvedValue([])
})

describe('GetHistoryUseCase', () => {
  it('throws NOT_FOUND when conversation does not exist', async () => {
    const useCase = new GetHistoryUseCase(conversationRepository, messageRepository)
    findConversationByIdMock.mockResolvedValue(null)

    await expect(useCase.execute({ conversationId: 'missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('returns conversation with empty messages when no messages exist', async () => {
    const useCase = new GetHistoryUseCase(conversationRepository, messageRepository)

    const output = await useCase.execute({ conversationId: 'conversation_1' })

    expect(output.conversation.conversationId).toBe('conversation_1')
    expect(output.messages).toEqual([])
  })

  it('returns messages from repository output', async () => {
    const useCase = new GetHistoryUseCase(conversationRepository, messageRepository)
    const messages = [
      makeMessage({ messageId: 'msg_1', createdAt: '2026-04-19T10:00:01.000Z', content: 'first' }),
      makeMessage({
        messageId: 'msg_2',
        role: 'avatar',
        createdAt: '2026-04-19T10:00:02.000Z',
        content: 'second',
      }),
    ]
    findMessagesByConversationIdMock.mockResolvedValue(messages)

    const output = await useCase.execute({ conversationId: 'conversation_1' })

    expect(output.messages).toEqual(messages)
  })
})
