import { describe, expect, it } from 'vitest'
import {
  toRecordedAvatarContextSnapshot,
  toRecordedGmContextSnapshot,
} from './runtime-inspector-event-context.js'

function expectNoContentLeak(snapshot: unknown, ...forbiddenValues: string[]): void {
  const serializedSnapshot = JSON.stringify(snapshot)
  for (const forbiddenValue of forbiddenValues) {
    expect(serializedSnapshot).not.toContain(forbiddenValue)
  }
}

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
      currentAvatarId: 'avatar_1',
      progression: 'intro',
      topicsCovered: [],
      interactionCount: 1,
    },
    availableAvatars: [{ avatarId: 'avatar_1', name: 'Clara' }],
    sections: {
      conversationState: {
        recentMessages: [{ role: 'user' as const, content: 'Who left last night?' }],
        memory: {},
      },
      retrievedContext: {
        memory: [
          {
            sourceId: 'source_memory',
            chunkId: 'chunk_memory',
            knowledgeType: 'memory' as const,
            content: 'Avatar secret',
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
  it('stores avatar retrieval as typed provenance without content or metadata', () => {
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
          score: 0.9,
          reason: 'token-overlap',
          visibleToAvatarIds: ['avatar_1'],
        },
      ],
      media: [],
    })
    expectNoContentLeak(
      snapshot,
      'Sensitive chunk text',
      'inlineText',
      'Secret trait identity',
      'Do not leak this',
    )
  })

  it('stores gm retrieval as typed provenance without content or metadata', () => {
    const snapshot = toRecordedGmContextSnapshot(createGmSnapshotInput())

    expect(snapshot.sections.retrievedContext).toEqual({
      memory: [
        {
          sourceId: 'source_memory',
          chunkId: 'chunk_memory',
          knowledgeType: 'memory',
        },
      ],
      world: [],
      media: [],
    })
    expectNoContentLeak(snapshot, 'Avatar secret', 'inlineText')
  })
})
