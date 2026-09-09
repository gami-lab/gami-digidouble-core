import { describe, expect, it } from 'vitest'
import type { RetrievalTrace } from '../../../domain/knowledge/knowledge.types.js'
import {
  parseRetrievalTraceDto,
  presentDistance,
  presentSimilarity,
  toRetrievalTraceDto,
} from './retrieval-trace-dto.js'

describe('retrieval-trace-dto', () => {
  it('maps retrieval traces to shared DTO shape', () => {
    const trace: RetrievalTrace = {
      query: 'dock',
      queryVectorCount: 1,
      candidateCount: 3,
      selectedCount: 1,
      duplicateCount: 1,
      selectionExcludedCount: 1,
      excludedCount: 2,
      outcome: 'success',
      embeddingProfile: {
        embeddingProfileId: 'embedding_profile_1',
        corpusGenerationId: 'corpus_generation_1',
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 16,
      },
      timings: { totalMs: 8, queryEmbeddingMs: 3, vectorSearchMs: 5 },
      perType: {
        memory: {
          sourceIds: ['source_memory_1'],
          selectedChunkIds: ['chunk_memory_1'],
          candidateCount: 1,
          selectedCount: 1,
          visibility: {
            mode: 'avatar_filtered',
            activeAvatarId: 'avatar_1',
            consideredChunkCount: 1,
            excludedChunkCount: 0,
          },
        },
        world: {
          sourceIds: ['source_world_1'],
          selectedChunkIds: [],
          candidateCount: 1,
          selectedCount: 0,
        },
        media: {
          sourceIds: ['source_media_1'],
          selectedChunkIds: [],
          candidateCount: 1,
          selectedCount: 0,
        },
      },
    }

    expect(toRetrievalTraceDto(trace)).toMatchObject({
      query: 'dock',
      perType: {
        memory: {
          visibility: {
            mode: 'avatar_filtered',
            activeAvatarId: 'avatar_1',
          },
        },
      },
    })
  })

  it('parses bounded retrieval traces and rejects invalid query sources', () => {
    const parsed = parseRetrievalTraceDto({
      query: 'dock',
      queries: [
        { source: 'last_user_input', text: 'dock now', queryIndex: 0 },
        { source: 'invalid_source', text: 'ignored', queryIndex: 1 },
      ],
      failure: { code: 'query_embedding_failed', retryable: true },
      perType: {
        memory: {
          sourceIds: ['source_memory_1'],
          selectedChunkIds: ['chunk_memory_1'],
          visibility: {
            mode: 'avatar_filtered',
            consideredChunkCount: 1,
            excludedChunkCount: 0,
          },
        },
        world: { sourceIds: [], selectedChunkIds: [] },
        media: { sourceIds: [], selectedChunkIds: [] },
      },
    })

    expect(parsed?.queries).toEqual([
      { source: 'last_user_input', text: 'dock now', queryIndex: 0 },
    ])
    expect(parsed?.failure).toEqual({ code: 'query_embedding_failed', retryable: true })
  })

  it('normalizes diagnostic distance and similarity', () => {
    expect(presentDistance(-1)).toBe(0)
    expect(presentDistance(0.123456)).toBe(0.1235)
    expect(presentSimilarity(1.123456)).toBe(1)
    expect(presentSimilarity(0.876544)).toBe(0.8765)
  })
})
