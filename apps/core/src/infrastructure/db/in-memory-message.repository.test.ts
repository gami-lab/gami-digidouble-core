import { describe, expect, it } from 'vitest'
import type { Message } from '../../domain/conversation/session.types.js'
import { InMemoryMessageRepository } from './in-memory-message.repository.js'

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

describe('InMemoryMessageRepository', () => {
  it("deleteByConversationId removes only the target conversation's messages", async () => {
    const repository = new InMemoryMessageRepository([
      makeMessage({ messageId: 'msg_1', conversationId: 'conversation_1' }),
      makeMessage({ messageId: 'msg_2', conversationId: 'conversation_1' }),
      makeMessage({ messageId: 'msg_3', conversationId: 'conversation_2' }),
    ])

    await repository.deleteByConversationId('conversation_1')

    const remainingConversation1 = await repository.findByConversationId('conversation_1')
    const remainingConversation2 = await repository.findByConversationId('conversation_2')
    expect(remainingConversation1).toEqual([])
    expect(remainingConversation2.map((message) => message.messageId)).toEqual(['msg_3'])
  })

  it('deleteByConversationId returns the number of deleted messages', async () => {
    const repository = new InMemoryMessageRepository([
      makeMessage({ messageId: 'msg_1', conversationId: 'conversation_1' }),
      makeMessage({ messageId: 'msg_2', conversationId: 'conversation_1' }),
      makeMessage({ messageId: 'msg_3', conversationId: 'conversation_2' }),
    ])

    const deletedCount = await repository.deleteByConversationId('conversation_1')

    expect(deletedCount).toBe(2)
  })

  it('deleteByConversationId returns 0 when conversation has no messages', async () => {
    const repository = new InMemoryMessageRepository([
      makeMessage({ messageId: 'msg_1', conversationId: 'conversation_1' }),
    ])

    const deletedCount = await repository.deleteByConversationId('conversation_missing')

    expect(deletedCount).toBe(0)
  })
})
