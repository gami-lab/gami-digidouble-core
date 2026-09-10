import { describe, expect, it } from 'vitest'
import { KnowledgeVectorSearchError } from '../../application/ports/IKnowledgeChunkRepository.js'
import type { KnowledgeChunk, KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'
import { InMemoryKnowledgeChunkRepository } from './in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from './in-memory-knowledge-source.repository.js'

const profile = { provider: 'fake', model: 'fake-embedding', dimensions: 3 }

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: 'knowledge_source_world',
    scenarioId: 'scenario_1',
    name: 'World source',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: 'memory://world',
    status: 'ready',
    createdAt: '2026-05-11T08:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

function makeChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    chunkId: 'knowledge_chunk_1',
    sourceId: 'knowledge_source_world',
    content: 'Chunk content',
    chunkIndex: 0,
    embedding: [1, 0, 0],
    embeddingProfileId: 'embedding_profile_active',
    corpusGenerationId: 'corpus_generation_active',
    createdAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

function makeRequest(
  overrides: Partial<Parameters<InMemoryKnowledgeChunkRepository['searchByVector']>[0]> = {},
) {
  return {
    queryVector: [1, 0, 0],
    queryVariant: { source: 'direct_query' as const, text: 'find this' },
    scenarioId: 'scenario_1',
    knowledgeType: 'world' as const,
    candidateLimit: 10,
    embeddingProfileId: 'embedding_profile_active',
    corpusGenerationId: 'corpus_generation_active',
    profile,
    visibilityMode: 'avatar_filtered' as const,
    ...overrides,
  }
}

function makeRepository(
  sources: KnowledgeSource[],
  chunks: KnowledgeChunk[],
): InMemoryKnowledgeChunkRepository {
  return new InMemoryKnowledgeChunkRepository(
    chunks,
    new InMemoryKnowledgeSourceRepository(sources),
  )
}

describe('InMemoryKnowledgeChunkRepository vector search', () => {
  it('returns bounded candidates in cosine-distance order with normalized similarity', async () => {
    const repository = makeRepository(
      [makeSource()],
      [
        makeChunk({ chunkId: 'knowledge_chunk_far', chunkIndex: 2, embedding: [0, 1, 0] }),
        makeChunk({ chunkId: 'knowledge_chunk_near', chunkIndex: 1, embedding: [1, 0.1, 0] }),
        makeChunk({ chunkId: 'knowledge_chunk_best', chunkIndex: 0, embedding: [1, 0, 0] }),
      ],
    )

    const candidates = await repository.searchByVector(makeRequest({ candidateLimit: 2 }))

    expect(candidates.map((candidate) => candidate.chunkId)).toEqual([
      'knowledge_chunk_best',
      'knowledge_chunk_near',
    ])
    expect(candidates[0]?.distance).toBe(0)
    expect(candidates[0]?.similarity).toBe(1)
    expect(candidates[1]?.similarity).toBe(1 - (1 - 1 / Math.sqrt(1.01)))
    expect(candidates[1]?.matchedQuery.source).toBe('direct_query')
  })

  it('filters scenario, type, readiness, source scope, profile, and generation before limiting', async () => {
    const sources = [
      makeSource({ sourceId: 'knowledge_source_allowed' }),
      makeSource({ sourceId: 'knowledge_source_wrong_scenario', scenarioId: 'scenario_2' }),
      makeSource({ sourceId: 'knowledge_source_pending', status: 'pending' }),
      makeSource({ sourceId: 'knowledge_source_media', knowledgeType: 'media' }),
    ]
    const repository = makeRepository(sources, [
      makeChunk({ sourceId: 'knowledge_source_allowed', chunkId: 'knowledge_chunk_allowed' }),
      makeChunk({
        sourceId: 'knowledge_source_wrong_scenario',
        chunkId: 'knowledge_chunk_wrong_scenario',
      }),
      makeChunk({ sourceId: 'knowledge_source_pending', chunkId: 'knowledge_chunk_pending' }),
      makeChunk({ sourceId: 'knowledge_source_media', chunkId: 'knowledge_chunk_media' }),
      makeChunk({
        chunkId: 'knowledge_chunk_wrong_profile',
        embeddingProfileId: 'embedding_profile_old',
      }),
      makeChunk({
        chunkId: 'knowledge_chunk_wrong_generation',
        corpusGenerationId: 'corpus_generation_old',
      }),
    ])

    const candidates = await repository.searchByVector(
      makeRequest({ eligibleSourceIds: ['knowledge_source_allowed'], candidateLimit: 1 }),
    )

    expect(candidates.map((candidate) => candidate.chunkId)).toEqual(['knowledge_chunk_allowed'])
  })
})

describe('InMemoryKnowledgeChunkRepository vector visibility', () => {
  it('keeps memory metadata scope and explicit visibility bypass separate', async () => {
    const sources = [
      makeSource({
        sourceId: 'knowledge_source_private',
        knowledgeType: 'avatar_knowledge',
        visibilityPolicy: 'avatars',
        visibleToAvatarIds: ['avatar_1'],
      }),
      makeSource({
        sourceId: 'knowledge_source_public',
        knowledgeType: 'avatar_knowledge',
        visibilityPolicy: 'all',
      }),
      makeSource({
        sourceId: 'knowledge_source_hidden',
        knowledgeType: 'avatar_knowledge',
        visibilityPolicy: 'none',
      }),
    ]
    const repository = makeRepository(sources, [
      makeChunk({
        sourceId: 'knowledge_source_private',
        chunkId: 'knowledge_chunk_private',
        metadata: { userId: 'user_1' },
      }),
      makeChunk({
        sourceId: 'knowledge_source_private',
        chunkId: 'knowledge_chunk_other_user',
        metadata: { userId: 'user_2' },
      }),
      makeChunk({ sourceId: 'knowledge_source_public', chunkId: 'knowledge_chunk_public' }),
      makeChunk({ sourceId: 'knowledge_source_hidden', chunkId: 'knowledge_chunk_hidden' }),
    ])

    const avatarCandidates = await repository.searchByVector(
      makeRequest({
        knowledgeType: 'avatar_knowledge',
        userId: 'user_1',
        activeAvatarId: 'avatar_1',
      }),
    )
    const missingAvatarCandidates = await repository.searchByVector(
      makeRequest({ knowledgeType: 'avatar_knowledge', userId: 'user_1' }),
    )
    const gmCandidates = await repository.searchByVector(
      makeRequest({
        knowledgeType: 'avatar_knowledge',
        userId: 'user_1',
        visibilityMode: 'gm_unrestricted',
      }),
    )

    expect(avatarCandidates.map((candidate) => candidate.chunkId)).toEqual([
      'knowledge_chunk_private',
      'knowledge_chunk_public',
    ])
    expect(missingAvatarCandidates.map((candidate) => candidate.chunkId)).toEqual([
      'knowledge_chunk_public',
    ])
    expect(gmCandidates.map((candidate) => candidate.chunkId)).toEqual([
      'knowledge_chunk_hidden',
      'knowledge_chunk_private',
      'knowledge_chunk_public',
    ])
  })

  it('fails incompatible query vectors without serializing vector values', async () => {
    const repository = makeRepository([makeSource()], [makeChunk()])
    const queryVector = [1, 2]

    const error = await repository
      .searchByVector(makeRequest({ queryVector }))
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(KnowledgeVectorSearchError)
    expect((error as KnowledgeVectorSearchError).failure).toEqual({
      code: 'incompatible_dimension',
      retryable: false,
    })
    expect(JSON.stringify(error)).not.toContain('1,2')
  })
})
