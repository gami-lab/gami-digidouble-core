import { describe, expect, it } from 'vitest'
import { ContextEngine } from './context-engine.service.js'
import type { ContextEngineInput } from './context-engine.types.js'

function makeInput(overrides: Partial<ContextEngineInput> = {}): ContextEngineInput {
  return {
    sessionId: 'session_1',
    activeAvatarId: 'avatar_1',
    recentMessages: [
      { role: 'user', content: 'hello there' },
      { role: 'avatar', content: 'hi' },
    ],
    scenario: {
      scenarioId: 'scenario_1',
      name: 'Onboarding',
      description: 'Scenario world',
      goals: ['goal_1'],
    },
    availableAvatars: [
      { avatarId: 'avatar_1', name: 'Guide', availability: 'available' },
      { avatarId: 'avatar_2', name: 'Specialist', availability: 'locked' },
    ],
    gmState: {
      currentAvatarId: 'avatar_1',
      progression: 'intro',
      topicsCovered: ['setup'],
      interactionCount: 2,
    },
    extensions: {
      memory: {
        shortTerm: { exchangeCount: 2, recentExchanges: [{ user: 'u1', avatar: 'a1' }] },
        working: {
          session: { summary: 'Session summary', updatedAt: '2026-05-01T10:00:00.000Z' },
          avatar: {
            avatarId: 'avatar_1',
            summary: 'Avatar summary',
            updatedAt: '2026-05-01T10:01:00.000Z',
          },
        },
        longTerm: { facts: [{ category: 'preference', key: 'style', value: 'concise' }] },
      },
      retrieval: {
        memory: [
          {
            sourceId: 'source_1',
            chunkId: 'chunk_1',
            knowledgeType: 'memory',
            content: 'memory item',
          },
        ],
        world: [
          { sourceId: 'source_2', chunkId: 'chunk_2', knowledgeType: 'world', content: 'world' },
        ],
        media: [
          { sourceId: 'source_3', chunkId: 'chunk_3', knowledgeType: 'media', content: 'media' },
        ],
        trace: {
          query: 'hello',
          perType: {
            memory: { sourceIds: ['source_1'], selectedChunkIds: ['chunk_1'] },
            world: { sourceIds: ['source_2'], selectedChunkIds: ['chunk_2'] },
            media: { sourceIds: ['source_3'], selectedChunkIds: ['chunk_3'] },
          },
        },
      },
      userPersona: { name: 'Maya', roleInWorld: 'student' },
      gmDirective: 'Focus on concrete steps.',
    },
    ...overrides,
  }
}

describe('ContextEngine', () => {
  it('assembles avatar and gm projections from one deterministic input', () => {
    const engine = new ContextEngine()
    const input = makeInput()
    const output = engine.assemble(input)

    expect(output.avatar.avatarId).toBe('avatar_1')
    expect(output.avatar.recentExchanges).toEqual([{ user: 'u1', avatar: 'a1' }])
    expect(output.avatar.knowledge?.retrievedItems).toHaveLength(3)
    expect(output.gm.currentState.progression).toBe('intro')
    expect(output.gm.memory.workingSummary).toContain('Session summary')
    expect(output.gm.memory.workingSummary).toContain('Avatar (avatar_1): Avatar summary')
    expect(output.gm.knowledge?.world[0]?.chunkId).toBe('chunk_2')
    expect(output.trace.deterministic).toBe(true)
    expect(output.trace.selectedInputs.retrievalCounts).toEqual({ memory: 1, world: 1, media: 1 })
  })

  it('stays deterministic with missing optional extensions', () => {
    const engine = new ContextEngine()
    const input = makeInput()
    delete input.activeAvatarId
    input.recentMessages = []
    input.extensions = {
      memory: undefined,
      retrieval: undefined,
      userPersona: null,
      gmDirective: null,
    }
    const output = engine.assemble(input)

    expect(output.avatar.avatarId).toBeUndefined()
    expect(output.avatar.recentExchanges).toEqual([])
    expect(output.avatar.longTermFacts).toEqual([])
    expect(output.avatar.knowledge).toBeUndefined()
    expect(output.gm.memory).toEqual({})
    expect(output.gm.knowledge).toBeUndefined()
    expect(output.trace.selectedInputs.hasUserPersona).toBe(false)
    expect(output.trace.selectedInputs.hasGmDirective).toBe(false)
    expect(output.trace.selectedInputs.recentMessageCount).toBe(0)
  })
})
