import { describe, expect, it } from 'vitest'
import { presentKnowledgeRetrieval } from './knowledge-retrieval.presenter.js'

describe('presentKnowledgeRetrieval', () => {
  it('truncates long retrieved content while preserving item structure', () => {
    const output = presentKnowledgeRetrieval(
      {
        memory: [
          {
            sourceId: 'knowledge_source_1',
            chunkId: 'knowledge_chunk_1',
            knowledgeType: 'memory',
            content: 'a'.repeat(120),
            score: 0.9,
            reason: 'token-overlap',
            metadata: { userId: 'user_1' },
          },
        ],
        world: [],
        media: [],
        trace: {
          query: 'budget',
          perType: {
            memory: { sourceIds: ['knowledge_source_1'], selectedChunkIds: ['knowledge_chunk_1'] },
            world: { sourceIds: [], selectedChunkIds: [] },
            media: { sourceIds: [], selectedChunkIds: [] },
          },
        },
      },
      100,
    )

    expect(output.retrieval.memory).toHaveLength(1)
    expect(output.retrieval.memory[0]?.content.length).toBe(103)
    expect(output.retrieval.memory[0]?.metadata).toEqual({ userId: 'user_1' })
    expect(output.retrieval.trace.query).toBe('budget')
  })

  it('does not alter content below the threshold', () => {
    const output = presentKnowledgeRetrieval(
      {
        memory: [],
        world: [
          {
            sourceId: 'knowledge_source_2',
            chunkId: 'knowledge_chunk_2',
            knowledgeType: 'world',
            content: 'short content',
          },
        ],
        media: [],
        trace: {
          query: 'timeline',
          perType: {
            memory: { sourceIds: [], selectedChunkIds: [] },
            world: { sourceIds: ['knowledge_source_2'], selectedChunkIds: ['knowledge_chunk_2'] },
            media: { sourceIds: [], selectedChunkIds: [] },
          },
        },
      },
      100,
    )

    expect(output.retrieval.world[0]?.content).toBe('short content')
  })
})
