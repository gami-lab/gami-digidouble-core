import { describe, expect, it } from 'vitest'
import {
  toRecordedAvatarContextSnapshot,
  toRecordedGmContextSnapshot,
} from './runtime-inspector-event-context.js'

describe('runtime inspector event context snapshots', () => {
  it('stores avatar retrieval as typed provenance without content or metadata', () => {
    const snapshot = toRecordedAvatarContextSnapshot({
      avatarId: 'avatar_1',
      recentExchanges: [{ user: 'u', avatar: 'a' }],
      workingMemory: {},
      longTermFacts: [],
      knowledge: {
        retrievedItems: [
          {
            sourceId: 'source_1',
            chunkId: 'chunk_1',
            knowledgeType: 'world',
            content: 'Sensitive chunk text',
            score: 0.9,
            reason: 'token-overlap',
            metadata: { inlineText: 'Sensitive chunk text' },
            visibleToAvatarIds: ['avatar_1'],
          },
        ],
      },
      userPersona: null,
      gmNotes: null,
      scenario: { scenarioId: 'scenario_1' },
    })

    expect(snapshot.knowledge).toEqual({
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
    expect(JSON.stringify(snapshot)).not.toContain('Sensitive chunk text')
    expect(JSON.stringify(snapshot)).not.toContain('inlineText')
  })

  it('stores gm retrieval as typed provenance without content or metadata', () => {
    const snapshot = toRecordedGmContextSnapshot({
      recentMessages: [{ role: 'user', content: 'Who left last night?' }],
      memory: {},
      knowledge: {
        memory: [
          {
            sourceId: 'source_memory',
            chunkId: 'chunk_memory',
            knowledgeType: 'memory',
            content: 'Avatar secret',
            metadata: { inlineText: 'Avatar secret' },
          },
        ],
        world: [],
        media: [],
      },
      currentState: {
        currentAvatarId: 'avatar_1',
        progression: 'intro',
        topicsCovered: [],
        interactionCount: 1,
      },
      availableAvatars: [{ avatarId: 'avatar_1', name: 'Clara' }],
      userPersona: null,
      scenario: { scenarioId: 'scenario_1' },
    })

    expect(snapshot.knowledge).toEqual({
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
    expect(JSON.stringify(snapshot)).not.toContain('Avatar secret')
    expect(JSON.stringify(snapshot)).not.toContain('inlineText')
  })
})
