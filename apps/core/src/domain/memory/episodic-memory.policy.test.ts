import { describe, expect, it } from 'vitest'
import {
  buildHydrationSummary,
  selectRelevantConversationMemories,
} from './episodic-memory.policy.js'
import type { ConversationMemory } from './memory.types.js'

function makeMemory(overrides: Partial<ConversationMemory> = {}): ConversationMemory {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    userId: 'user_1',
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    summary: 'Discussed pricing and rollout.',
    keyDiscoveries: ['Budget approval needed'],
    unresolvedTopics: ['Timeline unclear'],
    factCandidates: [
      { category: 'conversation_signal', key: 'thread_1', value: 'Timeline unclear' },
    ],
    createdAt: '2026-05-08T10:00:00.000Z',
    ...overrides,
  }
}

describe('episodic-memory policy', () => {
  it('prefers relevant recent episodes deterministically', () => {
    const memories = [
      makeMemory({ conversationId: 'conversation_1', createdAt: '2026-05-08T10:00:00.000Z' }),
      makeMemory({
        conversationId: 'conversation_2',
        summary: 'Discussed architecture and latency.',
        keyDiscoveries: ['Latency budget set'],
        createdAt: '2026-05-08T11:00:00.000Z',
      }),
    ]
    const selected = selectRelevantConversationMemories(
      memories,
      'Need latency architecture plan',
      1,
    )
    expect(selected[0]?.conversationId).toBe('conversation_2')
  })

  it('builds stable hydration summary', () => {
    const summary = buildHydrationSummary([
      makeMemory({ summary: 'Episode A' }),
      makeMemory({ conversationId: 'conversation_2', summary: 'Episode B' }),
    ])
    expect(summary).toContain('Hydration context:')
    expect(summary).toContain('Episode A')
    expect(summary).toContain('Episode B')
  })
})
