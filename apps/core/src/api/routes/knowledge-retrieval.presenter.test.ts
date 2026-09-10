import { describe, expect, it } from 'vitest'
import { presentKnowledgeRetrieval } from './knowledge-retrieval.presenter.js'

// eslint-disable-next-line max-lines-per-function
describe('presentKnowledgeRetrieval', () => {
  it('truncates long retrieved content while preserving item structure', () => {
    const output = presentKnowledgeRetrieval(
      {
        avatar_knowledge: [
          {
            sourceId: 'knowledge_source_1',
            chunkId: 'knowledge_chunk_1',
            knowledgeType: 'avatar_knowledge',
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
            avatar_knowledge: {
              sourceIds: ['knowledge_source_1'],
              selectedChunkIds: ['knowledge_chunk_1'],
            },
            world: { sourceIds: [], selectedChunkIds: [] },
            media: { sourceIds: [], selectedChunkIds: [] },
          },
        },
      },
      100,
    )

    expect(output.retrieval.avatar_knowledge).toHaveLength(1)
    expect(output.retrieval.avatar_knowledge[0]?.content.length).toBe(103)
    expect(output.retrieval.avatar_knowledge[0]?.metadata).toEqual({ userId: 'user_1' })
    expect(output.retrieval.trace.query).toBe('budget')
  })

  it('does not alter content below the threshold', () => {
    const output = presentKnowledgeRetrieval(
      {
        avatar_knowledge: [],
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
            avatar_knowledge: { sourceIds: [], selectedChunkIds: [] },
            world: { sourceIds: ['knowledge_source_2'], selectedChunkIds: ['knowledge_chunk_2'] },
            media: { sourceIds: [], selectedChunkIds: [] },
          },
        },
      },
      100,
    )

    expect(output.retrieval.world[0]?.content).toBe('short content')
  })

  it('maps vector diagnostics safely and normalizes display scores at the boundary', () => {
    const output = presentKnowledgeRetrieval({
      avatar_knowledge: [
        {
          sourceId: 'source_1',
          chunkId: 'chunk_1',
          knowledgeType: 'avatar_knowledge',
          content: 'retrieved content',
          distance: 0.123456,
          similarity: 0.876544,
          queryIndex: 2,
          matchedQuery: { source: 'last_user_input', text: 'query' },
        },
      ],
      world: [],
      media: [],
      trace: {
        query: 'query',
        candidateCount: 4,
        selectedCount: 1,
        excludedCount: 3,
        embeddingProfile: {
          embeddingProfileId: 'profile_1',
          corpusGenerationId: 'generation_1',
          provider: 'provider-neutral',
          model: 'embedding-model',
          dimensions: 16,
        },
        timings: { totalMs: 12, queryEmbeddingMs: 4, vectorSearchMs: 8 },
        queryVectorCount: 2,
        visibilityMode: 'gm_unrestricted',
        outcome: 'success',
        perType: {
          avatar_knowledge: {
            sourceIds: ['source_1'],
            selectedChunkIds: ['chunk_1'],
            candidateCount: 4,
            selectedCount: 1,
            excludedCount: 3,
            visibility: {
              mode: 'gm_unrestricted',
              consideredChunkCount: 4,
              excludedChunkCount: 0,
            },
          },
          world: { sourceIds: [], selectedChunkIds: [] },
          media: { sourceIds: [], selectedChunkIds: [] },
        },
      },
    })

    expect(output.retrieval.avatar_knowledge[0]).toMatchObject({
      distance: 0.1235,
      similarity: 0.8765,
      queryIndex: 2,
    })
    expect(output.retrieval.trace).toMatchObject({
      candidateCount: 4,
      selectedCount: 1,
      excludedCount: 3,
      queryVectorCount: 2,
      visibilityMode: 'gm_unrestricted',
    })
    expect(output.retrieval.trace.perType.avatar_knowledge.visibility?.mode).toBe('gm_unrestricted')
    expect(JSON.stringify(output)).not.toContain('embeddingVector')
  })
})
