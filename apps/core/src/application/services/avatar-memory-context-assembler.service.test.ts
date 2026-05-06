import { describe, expect, it, vi } from 'vitest'
import { InMemoryAvatarSessionMemoryRepository } from '../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionMemoryRepository } from '../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { AvatarMemoryContextAssembler } from './avatar-memory-context-assembler.service.js'

describe('AvatarMemoryContextAssembler short-term and working memory', () => {
  it('uses exactly the last 2 user/avatar exchanges for short-term memory', async () => {
    const messageRepository = new InMemoryMessageRepository([
      makeMessage('msg_1', 'user', 'u1', '2026-05-06T10:00:00.000Z'),
      makeMessage('msg_2', 'avatar', 'a1', '2026-05-06T10:00:01.000Z'),
      makeMessage('msg_3', 'user', 'u2', '2026-05-06T10:00:02.000Z'),
      makeMessage('msg_4', 'avatar', 'a2', '2026-05-06T10:00:03.000Z'),
      makeMessage('msg_5', 'user', 'u3', '2026-05-06T10:00:04.000Z'),
      makeMessage('msg_6', 'avatar', 'a3', '2026-05-06T10:00:05.000Z'),
    ])

    const assembler = new AvatarMemoryContextAssembler(messageRepository)
    const memory = await assembler.build({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      userId: 'user_1',
    })

    expect(memory?.shortTerm?.recentExchanges).toEqual([
      { user: 'u2', avatar: 'a2' },
      { user: 'u3', avatar: 'a3' },
    ])
  })

  it('omits working memory when repositories have no rows', async () => {
    const assembler = new AvatarMemoryContextAssembler(new InMemoryMessageRepository([]))
    const memory = await assembler.build({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      userId: 'user_1',
    })

    expect(memory?.working).toBeUndefined()
  })

  it('scopes avatar working memory to the active avatar only', async () => {
    const assembler = new AvatarMemoryContextAssembler(
      new InMemoryMessageRepository([]),
      new InMemorySessionMemoryRepository([
        {
          sessionId: 'session_1',
          summary: 'session summary',
          updatedAt: '2026-05-06T10:00:00.000Z',
        },
      ]),
      new InMemoryAvatarSessionMemoryRepository([
        {
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          summary: 'avatar one summary',
          updatedAt: '2026-05-06T10:00:00.000Z',
        },
        {
          sessionId: 'session_1',
          avatarId: 'avatar_2',
          summary: 'avatar two summary',
          updatedAt: '2026-05-06T10:00:00.000Z',
        },
      ]),
    )

    const memory = await assembler.build({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      userId: 'user_1',
    })

    expect(memory?.working?.session?.summary).toBe('session summary')
    expect(memory?.working?.avatar?.avatarId).toBe('avatar_1')
    expect(memory?.working?.avatar?.summary).toBe('avatar one summary')
  })
})

describe('AvatarMemoryContextAssembler long-term facts', () => {
  it('loads long-term facts in deterministic bounded order', async () => {
    const facts = Array.from({ length: 12 }, (_, index) => ({
      id: `umf_${String(index)}`,
      userId: 'user_1',
      category: 'pref',
      key: `k${String(index)}`,
      value: `v${String(index)}`,
      confidence: null,
      createdAt: '2026-05-06T10:00:00.000Z',
      updatedAt: `2026-05-06T10:00:${String(index).padStart(2, '0')}.000Z`,
    }))
    const userMemoryFactRepository = new InMemoryUserMemoryFactRepository(facts)
    const assembler = new AvatarMemoryContextAssembler(
      new InMemoryMessageRepository([]),
      undefined,
      undefined,
      userMemoryFactRepository,
    )

    const memory = await assembler.build({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      userId: 'user_1',
    })

    expect(memory?.longTerm?.facts).toHaveLength(10)
    expect(memory?.longTerm?.facts[0]).toEqual({ category: 'pref', key: 'k11', value: 'v11' })
    expect(memory?.longTerm?.facts[9]).toEqual({ category: 'pref', key: 'k2', value: 'v2' })
  })
})

describe('AvatarMemoryContextAssembler graceful degradation', () => {
  it('degrades gracefully when one memory source fails', async () => {
    const messageRepository = {
      findByConversationId: vi.fn().mockRejectedValue(new Error('unavailable')),
      save: vi.fn(),
      deleteByConversationId: vi.fn(),
    }
    const assembler = new AvatarMemoryContextAssembler(messageRepository, undefined, undefined, {
      findByUserId: vi.fn().mockRejectedValue(new Error('fact unavailable')),
      upsert: vi.fn(),
      deleteById: vi.fn(),
      findById: vi.fn(),
    })

    await expect(
      assembler.build({
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        userId: 'user_1',
      }),
    ).resolves.toBeUndefined()
  })
})

function makeMessage(
  messageId: string,
  role: 'user' | 'avatar' | 'system',
  content: string,
  createdAt: string,
) {
  return {
    messageId,
    conversationId: 'conversation_1',
    role,
    content,
    createdAt,
  }
}
