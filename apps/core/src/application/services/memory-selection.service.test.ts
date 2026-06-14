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
})
