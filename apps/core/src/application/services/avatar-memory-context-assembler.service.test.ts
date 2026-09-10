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

// eslint-disable-next-line max-lines-per-function
describe('AvatarMemoryContextAssembler long-term facts', () => {
  it('loads long-term facts in deterministic bounded order', async () => {
    const facts = Array.from({ length: 12 }, (_, index) => ({
      id: `umf_${String(index)}`,
      userId: 'user_1',
      category: 'pref',
      key: `k${String(index)}`,
      value: `v${String(index)}`,
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

  // eslint-disable-next-line complexity
  it('keeps recent exchanges, working memory, and facts isolated between users', async () => {
    const assembler = new AvatarMemoryContextAssembler(
      new InMemoryMessageRepository([
        {
          ...makeMessage('a_user', 'user', 'User A question', '2026-05-06T10:00:00.000Z'),
          conversationId: 'conversation_a',
        },
        {
          ...makeMessage('a_avatar', 'avatar', 'User A answer', '2026-05-06T10:00:01.000Z'),
          conversationId: 'conversation_a',
        },
        {
          ...makeMessage('b_user', 'user', 'User B question', '2026-05-06T10:00:02.000Z'),
          conversationId: 'conversation_b',
        },
        {
          ...makeMessage('b_avatar', 'avatar', 'User B answer', '2026-05-06T10:00:03.000Z'),
          conversationId: 'conversation_b',
        },
      ]),
      new InMemorySessionMemoryRepository([
        {
          sessionId: 'session_a',
          summary: 'User A working summary',
          updatedAt: '2026-05-06T10:00:00.000Z',
        },
        {
          sessionId: 'session_b',
          summary: 'User B working summary',
          updatedAt: '2026-05-06T10:00:00.000Z',
        },
      ]),
      undefined,
      new InMemoryUserMemoryFactRepository([
        {
          id: 'fact_a',
          userId: 'user_a',
          category: 'preference',
          key: 'style',
          value: 'User A preference',
          createdAt: '2026-05-06T10:00:00.000Z',
          updatedAt: '2026-05-06T10:00:00.000Z',
        },
        {
          id: 'fact_b',
          userId: 'user_b',
          category: 'preference',
          key: 'style',
          value: 'User B preference',
          createdAt: '2026-05-06T10:00:00.000Z',
          updatedAt: '2026-05-06T10:00:00.000Z',
        },
      ]),
    )

    const userA = await assembler.build({
      conversationId: 'conversation_a',
      sessionId: 'session_a',
      avatarId: 'avatar_1',
      userId: 'user_a',
    })
    const userB = await assembler.build({
      conversationId: 'conversation_b',
      sessionId: 'session_b',
      avatarId: 'avatar_1',
      userId: 'user_b',
    })

    expect(userA?.shortTerm?.recentExchanges).toEqual([
      { user: 'User A question', avatar: 'User A answer' },
    ])
    expect(userB?.shortTerm?.recentExchanges).toEqual([
      { user: 'User B question', avatar: 'User B answer' },
    ])
    expect(userA?.working?.session?.summary).toBe('User A working summary')
    expect(userB?.working?.session?.summary).toBe('User B working summary')
    expect(userA?.longTerm?.facts[0]?.value).toBe('User A preference')
    expect(userB?.longTerm?.facts[0]?.value).toBe('User B preference')
    expect(JSON.stringify(userA)).not.toContain('User B')
    expect(JSON.stringify(userB)).not.toContain('User A')
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
