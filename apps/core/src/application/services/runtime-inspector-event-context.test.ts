import { describe, expect, it } from 'vitest'
import {
  toRecordedAvatarContextSnapshot,
  toRecordedGmContextSnapshot,
} from './runtime-inspector-event-context.js'

function createAvatarSnapshotInput() {
  return {
    avatarId: 'avatar_1',
    sections: {
      directorNotes: null,
      responseRules: { items: [] },
      conversationState: {
        recentExchanges: [{ user: 'u', avatar: 'a' }],
        workingMemory: {},
        longTermFacts: [],
      },
      retrievedContext: {
        retrievedItems: [
          {
            sourceId: 'source_1',
            chunkId: 'chunk_1',
            knowledgeType: 'world' as const,
            content: 'Sensitive chunk text',
            matchedQuery: { source: 'last_user_input' as const, text: 'Who left?' },
            score: 0.9,
            reason: 'token-overlap',
            metadata: { inlineText: 'Sensitive chunk text' },
            visibleToAvatarIds: ['avatar_1'],
          },
        ],
      },
      userPersona: null,
      worldContext: { scenarioId: 'scenario_1' },
      avatarTraits: {
        identity: ['Secret trait identity'],
        personality: ['Hidden personality trait'],
        speakingStyle: ['Quiet and precise'],
        background: [],
        timeline: [],
        currentSituation: [],
        behaviouralRules: ['Do not leak this'],
      },
    },
  }
}

function createGmSnapshotInput() {
  return {
    currentState: {
      progression: 'intro',
      topicsCovered: [],
      interactionCount: 1,
    },
    availableAvatars: [{ avatarId: 'avatar_1', name: 'Clara' }],
    sections: {
      conversationState: {
        recentMessages: [{ role: 'user' as const, content: 'Who left last night?' }],
        memory: {
          workingMemory: {
            summary: 'Working summary',
            unresolvedThreads: ['Need dock confirmation'],
            coveredTopics: ['dock_timeline'],
          },
          workingSummary: 'Working summary',
        },
      },
      retrievedContext: {
        memory: [
          {
            sourceId: 'source_memory',
            chunkId: 'chunk_memory',
            knowledgeType: 'memory' as const,
            content: 'Avatar secret',
            matchedQuery: { source: 'world_context' as const, text: 'Scenario world' },
            metadata: { inlineText: 'Avatar secret' },
          },
        ],
        world: [],
        media: [],
      },
      userPersona: null,
      worldContext: { scenarioId: 'scenario_1' },
    },
  }
}

describe('runtime inspector event context snapshots', () => {
  it('stores avatar retrieval content and matched query without metadata', () => {
    const snapshot = toRecordedAvatarContextSnapshot(createAvatarSnapshotInput())

    expect(snapshot.sections.responseRules).toEqual({ count: 0 })
    expect(snapshot.sections.avatarTraits).toEqual({
      sectionCounts: {
        identity: 1,
        personality: 1,
        speakingStyle: 1,
        background: 0,
        timeline: 0,
        currentSituation: 0,
        behaviouralRules: 1,
      },
    })
    expect(snapshot.sections.retrievedContext).toEqual({
      memory: [],
      world: [
        {
          sourceId: 'source_1',
          chunkId: 'chunk_1',
          knowledgeType: 'world',
          content: 'Sensitive chunk text',
          score: 0.9,
          reason: 'token-overlap',
          matchedQuery: { source: 'last_user_input', text: 'Who left?' },
          visibleToAvatarIds: ['avatar_1'],
        },
      ],
      media: [],
    })
    expect(JSON.stringify(snapshot)).toContain('Sensitive chunk text')
    expect(JSON.stringify(snapshot)).toContain('Who left?')
    expect(JSON.stringify(snapshot)).not.toContain('inlineText')
    expect(JSON.stringify(snapshot)).not.toContain('Secret trait identity')
    expect(JSON.stringify(snapshot)).not.toContain('Do not leak this')
  })

  it('stores gm retrieval content and matched query without metadata', () => {
    const snapshot = toRecordedGmContextSnapshot(createGmSnapshotInput())

    expect(snapshot.sections.conversationState.memory.workingMemory).toEqual({
      summary: 'Working summary',
      unresolvedThreads: ['Need dock confirmation'],
      coveredTopics: ['dock_timeline'],
    })
    expect(snapshot.sections.conversationState.memory.workingSummary).toBe('Working summary')
    expect(snapshot.sections.retrievedContext).toEqual({
      memory: [
        {
          sourceId: 'source_memory',
          chunkId: 'chunk_memory',
          knowledgeType: 'memory',
          content: 'Avatar secret',
          matchedQuery: { source: 'world_context', text: 'Scenario world' },
        },
      ],
      world: [],
      media: [],
    })
    expect(snapshot.sections.retrievedContext?.memory[0]?.content).toBe('Avatar secret')
    expect(snapshot.sections.retrievedContext?.memory[0]?.matchedQuery?.text).toBe('Scenario world')
    expect(JSON.stringify(snapshot)).not.toContain('inlineText')
  })
})
