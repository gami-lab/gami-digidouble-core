import { describe, expect, it, vi } from 'vitest'
import { MemorySelectionService } from './memory-selection.service.js'

// eslint-disable-next-line max-lines-per-function
describe('MemorySelectionService', () => {
  it('selects bounded episodic memories with deterministic reasons', async () => {
    const service = new MemorySelectionService(
      {
        findByConversationId: vi.fn().mockResolvedValue([]),
      } as never,
      {
        findByConversationId: vi.fn().mockResolvedValue({
          conversationId: 'conversation_active',
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          summary: 'Active conversation summary',
          unresolvedThreads: ['Need budget plan'],
          coveredTopics: ['intro_complete'],
          candidateFacts: [],
          updatedAt: '2026-05-08T09:00:00.000Z',
        }),
      } as never,
      {
        listByScope: vi.fn().mockResolvedValue([
          {
            conversationId: 'conversation_old',
            sessionId: 'session_1',
            userId: 'user_1',
            avatarId: 'avatar_1',
            scenarioId: 'scenario_1',
            summary: 'Discussed project kickoff',
            keyDiscoveries: ['Project kickoff and budget'],
            unresolvedTopics: ['Need budget plan'],
            factCandidates: [],
            createdAt: '2026-05-01T09:00:00.000Z',
          },
          {
            conversationId: 'conversation_new',
            sessionId: 'session_1',
            userId: 'user_1',
            avatarId: 'avatar_1',
            scenarioId: 'scenario_1',
            summary: 'Discussed timeline',
            keyDiscoveries: ['Timeline and milestones'],
            unresolvedTopics: ['Confirm timeline'],
            factCandidates: [],
            createdAt: '2026-05-07T09:00:00.000Z',
          },
        ]),
      } as never,
      {
        findByUserId: vi.fn().mockResolvedValue([]),
      } as never,
    )

    const selected = await service.select({
      conversationId: 'conversation_active',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      userMessageText: 'Can we finalize the budget plan?',
    })

    expect(selected.workingMemory?.summary).toBe('Active conversation summary')
    expect(selected.workingMemory?.coveredTopics).toEqual(['intro_complete'])
    expect(selected.episodicMemories.length).toBe(2)
    expect(selected.episodicMemories[0]?.selectionReasons).toContain('continuity')
    expect(selected.episodicMemories[0]?.selectionReasons).toContain('relevance')
    expect(selected.episodicMemories[0]?.selectionReasons).toContain('unresolved_topic')
  })

  it('does not inject working memory when persisted memory is missing', async () => {
    const service = new MemorySelectionService(
      {
        findByConversationId: vi.fn().mockResolvedValue([
          {
            conversationId: 'conversation_active',
            role: 'user',
            content: 'Who is Dr. Moreau?',
            createdAt: '2026-05-08T09:00:00.000Z',
          },
          {
            conversationId: 'conversation_active',
            role: 'avatar',
            content: 'He is the physician.',
            createdAt: '2026-05-08T09:00:01.000Z',
          },
        ]),
      } as never,
      {
        findByConversationId: vi.fn().mockResolvedValue(null),
      } as never,
      {
        listByScope: vi.fn().mockResolvedValue([]),
      } as never,
      {
        findByUserId: vi.fn().mockResolvedValue([]),
      } as never,
    )

    const selected = await service.select({
      conversationId: 'conversation_active',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      userMessageText: 'Tell me more.',
    })

    expect(selected.workingMemory).toBeUndefined()
  })

  it('keeps only exchanges after the working-memory update with a one-exchange fallback', async () => {
    const service = new MemorySelectionService(
      {
        findByConversationId: vi.fn().mockResolvedValue([
          {
            conversationId: 'conversation_active',
            role: 'user',
            content: 'q1',
            createdAt: '2026-05-08T09:00:00.000Z',
          },
          {
            conversationId: 'conversation_active',
            role: 'avatar',
            content: 'a1',
            createdAt: '2026-05-08T09:00:01.000Z',
          },
          {
            conversationId: 'conversation_active',
            role: 'user',
            content: 'q2',
            createdAt: '2026-05-08T09:00:02.000Z',
          },
          {
            conversationId: 'conversation_active',
            role: 'avatar',
            content: 'a2',
            createdAt: '2026-05-08T09:00:03.000Z',
          },
        ]),
      } as never,
      {
        findByConversationId: vi.fn().mockResolvedValue({
          conversationId: 'conversation_active',
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          summary: 'Working summary',
          unresolvedThreads: [],
          coveredTopics: [],
          candidateFacts: [],
          updatedAt: '2026-05-08T09:00:01.500Z',
        }),
      } as never,
      {
        listByScope: vi.fn().mockResolvedValue([]),
      } as never,
      {
        findByUserId: vi.fn().mockResolvedValue([]),
      } as never,
    )

    const selected = await service.select({
      conversationId: 'conversation_active',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      userMessageText: 'Tell me more.',
    })

    expect(selected.shortTermExchanges).toEqual([{ user: 'q2', avatar: 'a2' }])
  })

  it('keeps working, episodic, and long-term memory isolated for two users', async () => {
    const service = new MemorySelectionService(
      {
        findByConversationId: vi.fn().mockImplementation((conversationId: string) => [
          {
            conversationId,
            role: 'user',
            content: `${conversationId} question`,
            createdAt: '2026-05-08T09:00:00.000Z',
          },
          {
            conversationId,
            role: 'avatar',
            content: `${conversationId} answer`,
            createdAt: '2026-05-08T09:00:01.000Z',
          },
        ]),
      } as never,
      {
        findByConversationId: vi.fn().mockImplementation((conversationId: string) => ({
          conversationId,
          sessionId: `session_for_${conversationId}`,
          avatarId: 'avatar_1',
          summary: `${conversationId} working summary`,
          unresolvedThreads: [],
          coveredTopics: [],
          candidateFacts: [],
          updatedAt: '2026-05-08T09:00:00.000Z',
        })),
      } as never,
      {
        listByScope: vi.fn().mockImplementation(({ userId }: { userId: string }) => [
          {
            conversationId: `conversation_for_${userId}`,
            sessionId: `session_for_${userId}`,
            userId,
            avatarId: 'avatar_1',
            scenarioId: 'scenario_1',
            summary: `${userId} episodic summary`,
            keyDiscoveries: [],
            unresolvedTopics: [],
            factCandidates: [],
            createdAt: '2026-05-08T09:00:00.000Z',
          },
        ]),
      } as never,
      {
        findByUserId: vi.fn().mockImplementation((userId: string) => [
          {
            id: `fact_${userId}`,
            userId,
            category: 'preference',
            key: 'style',
            value: `${userId} preference`,
            createdAt: '2026-05-08T09:00:00.000Z',
            updatedAt: '2026-05-08T09:00:00.000Z',
          },
        ]),
      } as never,
    )

    const userA = await service.select({
      conversationId: 'conversation_user_a',
      userId: 'user_a',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      userMessageText: 'user A request',
    })
    const userB = await service.select({
      conversationId: 'conversation_user_b',
      userId: 'user_b',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      userMessageText: 'user B request',
    })

    expect(userA.shortTermExchanges[0]).toEqual({
      user: 'conversation_user_a question',
      avatar: 'conversation_user_a answer',
    })
    expect(userB.shortTermExchanges[0]).toEqual({
      user: 'conversation_user_b question',
      avatar: 'conversation_user_b answer',
    })
    expect(userA.workingMemory?.summary).toBe('conversation_user_a working summary')
    expect(userB.workingMemory?.summary).toBe('conversation_user_b working summary')
    expect(userA.episodicMemories[0]?.summary).toBe('user_a episodic summary')
    expect(userB.episodicMemories[0]?.summary).toBe('user_b episodic summary')
    expect(userA.longTermFacts[0]?.value).toBe('user_a preference')
    expect(userB.longTermFacts[0]?.value).toBe('user_b preference')
    expect(JSON.stringify(userA)).not.toContain('user_b')
    expect(JSON.stringify(userB)).not.toContain('user_a')
  })
})
