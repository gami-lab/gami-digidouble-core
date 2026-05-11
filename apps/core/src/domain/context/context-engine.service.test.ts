import { describe, expect, it } from 'vitest'
import { ContextEngine } from './context-engine.service.js'
import type { ContextEngineInput } from './context-engine.types.js'
import type { ContextEnginePolicy } from './context-engine.policy.js'
import type { LayeredMemorySnapshot } from '../memory/memory.types.js'
import type { TypedRetrievalResult } from '../knowledge/knowledge.types.js'

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

function requireMemory(input: ContextEngineInput): LayeredMemorySnapshot {
  if (input.extensions.memory === undefined) throw new Error('Expected memory fixture')
  return input.extensions.memory
}

function requireRetrieval(input: ContextEngineInput): TypedRetrievalResult {
  if (input.extensions.retrieval === undefined) throw new Error('Expected retrieval fixture')
  return input.extensions.retrieval
}

describe('ContextEngine baseline', () => {
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
    expect(output.trace.selection.trimmed).toEqual([])
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

  it('applies deterministic precedence trimming with protected segments', () => {
    const tinyBudgetPolicy: ContextEnginePolicy = {
      tokenBudget: {
        avatarMaxTokens: 8,
        gmMaxTokens: 8,
      },
      protectedSegments: ['gmDirective', 'scenario'],
      precedence: [
        'gmDirective',
        'scenario',
        'userPersona',
        'shortTermMemory',
        'workingMemory',
        'longTermFacts',
        'typedRetrievalMemory',
        'typedRetrievalWorld',
        'typedRetrievalMedia',
        'recentMessages',
      ],
    }

    const engine = new ContextEngine(tinyBudgetPolicy)
    const output = engine.assemble(makeInput())

    expect(output.avatar.gmNotes).toBe('Focus on concrete steps.')
    expect(output.avatar.scenario.scenarioId).toBe('scenario_1')
    expect(output.avatar.recentExchanges).toEqual([])
    expect(output.avatar.longTermFacts).toEqual([])
    expect(output.avatar.knowledge).toBeUndefined()
    expect(
      output.trace.selection.trimmed.some((item) => item.segmentId === 'shortTermMemory'),
    ).toBe(true)
    expect(
      output.trace.selection.trimmed.some((item) => item.segmentId === 'typedRetrievalMemory'),
    ).toBe(true)
    expect(
      output.trace.selection.kept.some(
        (item) => item.segmentId === 'gmDirective' && item.reason === 'protected',
      ),
    ).toBe(true)
  })
})

describe('ContextEngine policy', () => {
  it('resolves conflicts deterministically by deduping long-term facts and retrieval chunk ids', () => {
    const engine = new ContextEngine()
    const input = makeInput()
    const memory = requireMemory(input)
    const retrieval = requireRetrieval(input)
    input.extensions.memory = {
      ...memory,
      longTerm: {
        facts: [
          { category: 'preference', key: 'style', value: 'concise' },
          { category: 'Preference', key: 'Style', value: 'verbose' },
        ],
      },
    }
    input.extensions.retrieval = {
      ...retrieval,
      memory: [
        ...retrieval.memory,
        {
          sourceId: 'source_dup',
          chunkId: 'chunk_2',
          knowledgeType: 'memory',
          content: 'memory duplicate of world chunk id',
        },
      ],
      world: [
        ...retrieval.world,
        {
          sourceId: 'source_dup_2',
          chunkId: 'chunk_2',
          knowledgeType: 'world',
          content: 'world duplicate',
        },
      ],
    }

    const output = engine.assemble(input)

    expect(output.avatar.longTermFacts).toEqual([
      { category: 'preference', key: 'style', value: 'concise' },
    ])
    const avatarChunkIds = output.avatar.knowledge?.retrievedItems.map((item) => item.chunkId) ?? []
    expect(avatarChunkIds).toEqual(['chunk_1', 'chunk_2', 'chunk_3'])
    expect(output.gm.knowledge?.memory.map((item) => item.chunkId)).toContain('chunk_2')
    expect(output.gm.knowledge?.world).toEqual([])
  })
})
