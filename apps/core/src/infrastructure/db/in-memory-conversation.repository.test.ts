import { describe, expect, it } from 'vitest'
import type { Conversation } from '../../domain/conversation/session.types.js'
import { InMemoryConversationRepository } from './in-memory-conversation.repository.js'

function makeConversation(overrides: Partial<Conversation>): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-21T08:00:00.000Z',
    lastActivityAt: '2026-04-21T08:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryConversationRepository', () => {
  it('listBySessionId returns conversations for the requested session', async () => {
    const repository = new InMemoryConversationRepository([
      makeConversation({ conversationId: 'conversation_1', sessionId: 'session_1' }),
      makeConversation({ conversationId: 'conversation_2', sessionId: 'session_1' }),
      makeConversation({ conversationId: 'conversation_3', sessionId: 'session_2' }),
    ])

    const result = await repository.listBySessionId('session_1')

    expect(result.map((item) => item.conversationId)).toEqual(['conversation_1', 'conversation_2'])
  })

  it('update mutates the selected conversation only', async () => {
    const repository = new InMemoryConversationRepository([
      makeConversation({ conversationId: 'conversation_1', status: 'active' }),
    ])

    const updated = await repository.update('conversation_1', { status: 'closed' })

    expect(updated.status).toBe('closed')
  })
})
