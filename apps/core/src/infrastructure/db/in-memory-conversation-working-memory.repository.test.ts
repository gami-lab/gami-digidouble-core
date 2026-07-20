import { describe, expect, it } from 'vitest'
import { InMemoryConversationWorkingMemoryRepository } from './in-memory-conversation-working-memory.repository.js'

describe('InMemoryConversationWorkingMemoryRepository', () => {
  it('upserts and loads by conversation id', async () => {
    const repository = new InMemoryConversationWorkingMemoryRepository()

    await repository.upsert({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Summary',
      unresolvedThreads: ['Need scope'],
      coveredTopics: ['scope_reviewed'],
      candidateFacts: [{ category: 'conversation_signal', key: 'thread_1', value: 'Need scope' }],
    })

    await expect(repository.findByConversationId('conversation_1')).resolves.toMatchObject({
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Summary',
    })
  })

  it('deleteBySessionId removes all rows for a session', async () => {
    const repository = new InMemoryConversationWorkingMemoryRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'S1',
        unresolvedThreads: [],
        coveredTopics: [],
        candidateFacts: [],
        updatedAt: '2026-05-08T10:00:00.000Z',
      },
      {
        conversationId: 'conversation_2',
        sessionId: 'session_1',
        avatarId: 'avatar_2',
        summary: 'S2',
        unresolvedThreads: [],
        coveredTopics: [],
        candidateFacts: [],
        updatedAt: '2026-05-08T10:00:00.000Z',
      },
      {
        conversationId: 'conversation_3',
        sessionId: 'session_2',
        avatarId: 'avatar_2',
        summary: 'S3',
        unresolvedThreads: [],
        coveredTopics: [],
        candidateFacts: [],
        updatedAt: '2026-05-08T10:00:00.000Z',
      },
    ])

    await expect(repository.deleteBySessionId('session_1')).resolves.toBe(2)
    await expect(repository.findByConversationId('conversation_1')).resolves.toBeNull()
    await expect(repository.findByConversationId('conversation_2')).resolves.toBeNull()
    await expect(repository.findByConversationId('conversation_3')).resolves.toMatchObject({
      sessionId: 'session_2',
    })
  })

  it('defaults covered topics for legacy seeded rows', async () => {
    const repository = new InMemoryConversationWorkingMemoryRepository([
      {
        conversationId: 'conversation_legacy',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'Legacy row',
        unresolvedThreads: [],
        candidateFacts: [],
        updatedAt: '2026-05-08T10:00:00.000Z',
      },
    ])

    await expect(repository.findByConversationId('conversation_legacy')).resolves.toMatchObject({
      coveredTopics: [],
    })
  })
})
