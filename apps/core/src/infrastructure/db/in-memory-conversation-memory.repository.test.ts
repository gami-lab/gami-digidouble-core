import { describe, expect, it } from 'vitest'
import { InMemoryConversationMemoryRepository } from './in-memory-conversation-memory.repository.js'

describe('InMemoryConversationMemoryRepository', () => {
  it('creates one immutable memory per conversation', async () => {
    const repository = new InMemoryConversationMemoryRepository()
    const first = await repository.create({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      summary: 'Summary one',
      keyDiscoveries: ['d1'],
      unresolvedTopics: ['u1'],
      factCandidates: [{ category: 'conversation_signal', key: 'k1', value: 'v1' }],
    })
    const second = await repository.create({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      summary: 'Summary two',
      keyDiscoveries: ['d2'],
      unresolvedTopics: ['u2'],
      factCandidates: [{ category: 'conversation_signal', key: 'k2', value: 'v2' }],
    })
    expect(second.summary).toBe(first.summary)
  })

  it('lists by user/avatar/scenario scope with recency ordering', async () => {
    const repository = new InMemoryConversationMemoryRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        userId: 'user_1',
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        summary: 'Older',
        keyDiscoveries: [],
        unresolvedTopics: [],
        factCandidates: [],
        createdAt: '2026-05-08T09:00:00.000Z',
      },
      {
        conversationId: 'conversation_2',
        sessionId: 'session_2',
        userId: 'user_1',
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        summary: 'Newer',
        keyDiscoveries: [],
        unresolvedTopics: [],
        factCandidates: [],
        createdAt: '2026-05-08T10:00:00.000Z',
      },
    ])
    const result = await repository.listByScope({
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      limit: 10,
    })
    expect(result.map((item) => item.conversationId)).toEqual(['conversation_2', 'conversation_1'])
  })
})
