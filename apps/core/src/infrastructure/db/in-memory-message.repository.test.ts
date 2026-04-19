import { describe, expect, it } from 'vitest'
import type { Message } from '../../domain/conversation/session.types.js'
import { InMemoryMessageRepository } from './in-memory-message.repository.js'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    messageId: 'msg_1',
    sessionId: 'session_1',
    role: 'user',
    content: 'hello',
    createdAt: '2026-04-19T10:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryMessageRepository', () => {
  it("deleteBySessionId removes only the target session's messages", async () => {
    const repository = new InMemoryMessageRepository([
      makeMessage({ messageId: 'msg_1', sessionId: 'session_1' }),
      makeMessage({ messageId: 'msg_2', sessionId: 'session_1' }),
      makeMessage({ messageId: 'msg_3', sessionId: 'session_2' }),
    ])

    await repository.deleteBySessionId('session_1')

    const remainingSession1 = await repository.findBySessionId('session_1')
    const remainingSession2 = await repository.findBySessionId('session_2')
    expect(remainingSession1).toEqual([])
    expect(remainingSession2.map((message) => message.messageId)).toEqual(['msg_3'])
  })

  it('deleteBySessionId returns the number of deleted messages', async () => {
    const repository = new InMemoryMessageRepository([
      makeMessage({ messageId: 'msg_1', sessionId: 'session_1' }),
      makeMessage({ messageId: 'msg_2', sessionId: 'session_1' }),
      makeMessage({ messageId: 'msg_3', sessionId: 'session_2' }),
    ])

    const deletedCount = await repository.deleteBySessionId('session_1')

    expect(deletedCount).toBe(2)
  })

  it('deleteBySessionId returns 0 when session has no messages', async () => {
    const repository = new InMemoryMessageRepository([
      makeMessage({ messageId: 'msg_1', sessionId: 'session_1' }),
    ])

    const deletedCount = await repository.deleteBySessionId('session_missing')

    expect(deletedCount).toBe(0)
  })
})
