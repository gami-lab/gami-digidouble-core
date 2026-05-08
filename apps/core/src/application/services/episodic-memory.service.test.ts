import { describe, expect, it } from 'vitest'
import { InMemoryConversationMemoryRepository } from '../../infrastructure/db/in-memory-conversation-memory.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { EpisodicMemoryService } from './episodic-memory.service.js'

describe('EpisodicMemoryService', () => {
  it('creates one episodic memory on closed conversation generation', async () => {
    const conversationMemoryRepository = new InMemoryConversationMemoryRepository()
    const conversationWorkingMemoryRepository = new InMemoryConversationWorkingMemoryRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'Working summary',
        unresolvedThreads: ['Thread A'],
        candidateFacts: [{ category: 'conversation_signal', key: 'k1', value: 'v1' }],
        updatedAt: '2026-05-08T10:00:00.000Z',
      },
    ])
    const service = new EpisodicMemoryService(
      conversationMemoryRepository,
      conversationWorkingMemoryRepository,
      new InMemoryMessageRepository([]),
    )

    const first = await service.generateForClosedConversation({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
    })
    const second = await service.generateForClosedConversation({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
    })

    expect(second.createdAt).toBe(first.createdAt)
    await expect(
      conversationMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toMatchObject({ summary: 'Working summary' })
  })

  it('hydrates new conversation deterministically from episodic scope', async () => {
    const conversationMemoryRepository = new InMemoryConversationMemoryRepository([
      {
        conversationId: 'conversation_older',
        sessionId: 'session_1',
        userId: 'user_1',
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        summary: 'Discussed pricing',
        keyDiscoveries: ['Budget gate'],
        unresolvedTopics: ['Need pricing table'],
        factCandidates: [
          { category: 'conversation_signal', key: 'k1', value: 'Need pricing table' },
        ],
        createdAt: '2026-05-08T09:00:00.000Z',
      },
      {
        conversationId: 'conversation_newer',
        sessionId: 'session_2',
        userId: 'user_1',
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        summary: 'Discussed latency architecture',
        keyDiscoveries: ['Latency budget'],
        unresolvedTopics: ['Need benchmark'],
        factCandidates: [{ category: 'conversation_signal', key: 'k2', value: 'Need benchmark' }],
        createdAt: '2026-05-08T10:00:00.000Z',
      },
      {
        conversationId: 'conversation_other_scope',
        sessionId: 'session_9',
        userId: 'user_2',
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        summary: 'Other user memory',
        keyDiscoveries: ['ignore'],
        unresolvedTopics: ['ignore'],
        factCandidates: [],
        createdAt: '2026-05-08T11:00:00.000Z',
      },
    ])
    const service = new EpisodicMemoryService(
      conversationMemoryRepository,
      new InMemoryConversationWorkingMemoryRepository(),
      new InMemoryMessageRepository([]),
    )

    const hydration = await service.hydrateForNewConversation({
      conversationId: 'conversation_3',
      sessionId: 'session_3',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      queryText: 'Need latency benchmark',
    })

    expect(hydration.summary).toContain('Hydration context:')
    expect(hydration.summary).toContain('latency architecture')
    expect(hydration.unresolvedThreads).toContain('Need benchmark')
    expect(hydration.summary).not.toContain('Other user memory')
  })
})
