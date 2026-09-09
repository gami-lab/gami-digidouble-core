import { describe, expect, it, vi } from 'vitest'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { SemanticFixtureEmbeddingAdapter } from '../../../infrastructure/knowledge/test-support/semantic-fixture-embedding.adapter.js'
import { NullObservabilityAdapter } from '../../../infrastructure/observability/null.adapter.js'
import { KnowledgeVectorSearchError } from '../../ports/IKnowledgeChunkRepository.js'
import type { ActiveCorpus } from '../../ports/IKnowledgeCorpusRepository.js'
import {
  KnowledgeQueryEmbeddingService,
  type RetrievalQueryEmbeddingResult,
} from './knowledge-query-embedding.service.js'
import { TypedRetrievalService } from './typed-retrieval.service.js'
import type { KnowledgeType } from '../../../domain/knowledge/knowledge.types.js'

const profile = {
  embeddingProfileId: 'profile_1',
  corpusGenerationId: 'generation_1',
  provider: 'fake',
  model: 'fake-embedding',
  dimensions: 2,
}

const semanticProfile = {
  provider: 'fixture',
  model: 'semantic-groups-v1',
  dimensions: 3,
}

const semanticCorpus: ActiveCorpus = {
  embeddingProfileId: 'profile_semantic',
  corpusGenerationId: 'generation_semantic',
  profile: semanticProfile,
}

function source(
  sourceId: string,
  knowledgeType: KnowledgeType,
  extra: Record<string, unknown> = {},
) {
  return {
    sourceId,
    scenarioId: 'scenario_1',
    name: sourceId,
    knowledgeType,
    format: 'text' as const,
    uriOrPath: `/${sourceId}.txt`,
    status: 'ready' as const,
    createdAt: '2026-05-11T10:00:00.000Z',
    updatedAt: '2026-05-11T10:00:00.000Z',
    ...extra,
  }
}

function chunk(
  chunkId: string,
  sourceId: string,
  vector: readonly number[],
  extra: Record<string, unknown> = {},
) {
  return {
    chunkId,
    sourceId,
    content: chunkId,
    chunkIndex: 0,
    embedding: vector,
    embeddingProfileId: profile.embeddingProfileId,
    corpusGenerationId: profile.corpusGenerationId,
    createdAt: '2026-05-11T10:00:00.000Z',
    ...extra,
  }
}

function embeddingResult(
  variants: RetrievalQueryEmbeddingResult['queries'],
  vectors: readonly (readonly number[])[],
): RetrievalQueryEmbeddingResult {
  const queries = variants.map((variant, queryIndex) => ({ ...variant, queryIndex }))
  return {
    queries,
    queryVectors: vectors.map((vector, queryIndex) => {
      const query = queries[queryIndex]
      if (query === undefined) throw new Error('Missing fake query variant.')
      return { vector, variant: query, queryIndex }
    }),
    diagnostics: {
      outcome: 'success',
      queryVectorCount: vectors.length,
      embeddingProfile: profile,
      timings: { totalMs: 2, queryEmbeddingMs: 2 },
    },
  }
}

function buildService(
  chunks: ReturnType<typeof chunk>[],
  embedding: RetrievalQueryEmbeddingResult,
) {
  const sourceRepository = new InMemoryKnowledgeSourceRepository([
    source('memory_source', 'memory'),
    source('world_source', 'world'),
    source('media_source', 'media'),
  ])
  const chunkRepository = new InMemoryKnowledgeChunkRepository(chunks, sourceRepository)
  const embedVariants = vi.fn().mockResolvedValue(embedding)
  const service = new TypedRetrievalService(sourceRepository, chunkRepository, { embedVariants })
  return { service, embedVariants, chunkRepository }
}

// eslint-disable-next-line max-lines-per-function
describe('TypedRetrievalService', () => {
  // eslint-disable-next-line complexity
  it('retrieves semantic paraphrases without lexical overlap and excludes unrelated vectors', async () => {
    const semanticSource = source('semantic_world_source', 'world')
    const chunkRepository = new InMemoryKnowledgeChunkRepository(
      [
        {
          chunkId: 'harbor_fact',
          sourceId: semanticSource.sourceId,
          content: 'The east harbor is safe for docking.',
          chunkIndex: 0,
          embedding: [1, 0, 0],
          embeddingProfileId: semanticCorpus.embeddingProfileId,
          corpusGenerationId: semanticCorpus.corpusGenerationId,
          createdAt: '2026-05-11T10:00:00.000Z',
        },
        {
          chunkId: 'pier_fact',
          sourceId: semanticSource.sourceId,
          content: 'The western pier is closed.',
          chunkIndex: 1,
          embedding: [0.2, 0, 0.98],
          embeddingProfileId: semanticCorpus.embeddingProfileId,
          corpusGenerationId: semanticCorpus.corpusGenerationId,
          createdAt: '2026-05-11T10:00:00.000Z',
        },
        {
          chunkId: 'unrelated_lantern',
          sourceId: semanticSource.sourceId,
          content: 'A blue lantern hangs beside the harbor.',
          chunkIndex: 2,
          embedding: [0, 0.5, 0.866],
          embeddingProfileId: semanticCorpus.embeddingProfileId,
          corpusGenerationId: semanticCorpus.corpusGenerationId,
          createdAt: '2026-05-11T10:00:00.000Z',
        },
      ],
      new InMemoryKnowledgeSourceRepository([semanticSource]),
    )
    chunkRepository.setActiveCorpus(semanticCorpus)
    const queryEmbeddingService = new KnowledgeQueryEmbeddingService(
      { getActiveCorpus: () => Promise.resolve(semanticCorpus) },
      new SemanticFixtureEmbeddingAdapter(
        semanticProfile,
        new Map([
          ['¿Dónde puedo atracar?', [1, 0, 0]],
          ['Quelle jetée est fermée ?', [0, 0, 1]],
        ]),
      ),
      new NullObservabilityAdapter(),
    )
    const service = new TypedRetrievalService(
      new InMemoryKnowledgeSourceRepository([semanticSource]),
      chunkRepository,
      queryEmbeddingService,
    )

    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'unused compatibility query',
      queries: [
        { source: 'last_user_input', text: '¿Dónde puedo atracar?' },
        { source: 'gm_required_fact', text: 'Quelle jetée est fermée ?' },
      ],
      limitPerType: 2,
    })

    expect(result.world.map((item) => item.chunkId)).toEqual(['harbor_fact', 'pier_fact'])
    expect(result.world[0]?.matchedQuery?.source).toBe('last_user_input')
    expect(result.world[0]?.matchedQuery?.text).toBe('¿Dónde puedo atracar?')
    expect(result.world[0]?.queryIndex).toBe(0)
    expect(result.world[0]?.similarity).toBe(1)
    expect(result.world[0]?.distance).toBe(0)
    expect(result.world[1]?.matchedQuery?.source).toBe('gm_required_fact')
    expect(result.world[1]?.matchedQuery?.text).toBe('Quelle jetée est fermée ?')
    expect(result.world[1]?.queryIndex).toBe(1)
    expect(result.world).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ chunkId: 'unrelated_lantern' })]),
    )
    expect(result.trace.queryVectorCount).toBe(2)
    expect(result.trace.embeddingProfile).toEqual({
      ...semanticProfile,
      embeddingProfileId: semanticCorpus.embeddingProfileId,
      corpusGenerationId: semanticCorpus.corpusGenerationId,
    })
  })

  it('embeds once, searches bounded vector pools, and returns cosine diagnostics', async () => {
    const { service, embedVariants, chunkRepository } = buildService(
      [chunk('memory_1', 'memory_source', [1, 0])],
      embeddingResult([{ source: 'last_user_input', text: 'memory' }], [[1, 0]]),
    )
    const searchByVector = vi.spyOn(chunkRepository, 'searchByVector')

    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'memory',
      limitPerType: 2,
    })

    expect(embedVariants).toHaveBeenCalledTimes(1)
    expect(searchByVector).toHaveBeenCalledTimes(3)
    expect(searchByVector.mock.calls.every(([request]) => request.candidateLimit === 2)).toBe(true)
    expect(result.memory[0]).toEqual(
      expect.objectContaining({
        chunkId: 'memory_1',
        score: 1,
        distance: 0,
        similarity: 1,
        reason: 'vector-match',
        queryIndex: 0,
      }),
    )
    expect(result.trace.queryVectorCount).toBe(1)
    expect(result.trace.visibilityMode).toBe('avatar_filtered')
    expect(result.trace.gmUnrestricted).toBe(false)
  })

  it('deduplicates a chunk across variants using the best similarity and stable ties', async () => {
    const { service } = buildService(
      [
        chunk('memory_best', 'memory_source', [1, 0]),
        chunk('memory_other', 'memory_source', [0, 1]),
      ],
      embeddingResult(
        [
          { source: 'last_user_input', text: 'first' },
          { source: 'gm_retrieval_query', text: 'second' },
        ],
        [
          [0, 1],
          [1, 0],
        ],
      ),
    )

    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'first',
      limitPerType: 3,
    })

    expect(result.memory).toHaveLength(2)
    expect(result.memory.find((item) => item.chunkId === 'memory_best')).toEqual(
      expect.objectContaining({ queryIndex: 1 }),
    )
    expect(new Set(result.memory.map((item) => item.chunkId)).size).toBe(2)
    expect(result.trace.perType.memory).toEqual(expect.objectContaining({ duplicateCount: 2 }))
    expect(result.trace).toEqual(expect.objectContaining({ duplicateCount: 2 }))
  })

  it('preserves avatar filtering and passes memory scope to the vector repository', async () => {
    const { service, chunkRepository } = buildService(
      [
        chunk('memory_visible', 'memory_source', [1, 0], { metadata: { userId: 'user_1' } }),
        chunk('memory_other_user', 'memory_source', [1, 0], { metadata: { userId: 'user_2' } }),
        chunk('world_hidden', 'world_source', [1, 0], { visibleToAvatarIds: ['avatar_2'] }),
      ],
      embeddingResult([{ source: 'last_user_input', text: 'memory' }], [[1, 0]]),
    )

    const listBySourceIds = vi.spyOn(chunkRepository, 'listBySourceIds')
    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'memory',
      userId: 'user_1',
      activeAvatarId: 'avatar_1',
    })

    expect(result.memory.map((item) => item.chunkId)).toEqual(['memory_visible'])
    expect(result.world).toHaveLength(0)
    expect(result.trace.visibilityMode).toBe('avatar_filtered')
    expect(listBySourceIds).not.toHaveBeenCalled()
  })

  it('uses explicit unrestricted GM visibility', async () => {
    const { service } = buildService(
      [chunk('world_hidden', 'world_source', [1, 0], { visibleToAvatarIds: ['avatar_2'] })],
      embeddingResult([{ source: 'world_context', text: 'world' }], [[1, 0]]),
    )

    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'world',
      activeAvatarId: 'avatar_1',
      bypassVisibilityFilter: true,
    })

    expect(result.world).toHaveLength(1)
    expect(result.trace.visibilityMode).toBe('gm_unrestricted')
    expect(result.trace.gmUnrestricted).toBe(true)
  })

  it('returns a controlled empty result for embedding failure without searching', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository([
      source('memory_source', 'memory'),
    ])
    const chunkRepository = new InMemoryKnowledgeChunkRepository([], sourceRepository)
    const embedVariants = vi.fn().mockResolvedValue({
      queries: [{ source: 'direct_query', text: 'memory', queryIndex: 0 }],
      queryVectors: [],
      diagnostics: {
        outcome: 'failed',
        queryVectorCount: 0,
        timings: { totalMs: 1, queryEmbeddingMs: 1 },
        failure: { code: 'query_embedding_failed', retryable: true },
      },
    } satisfies RetrievalQueryEmbeddingResult)
    const searchByVector = vi.spyOn(chunkRepository, 'searchByVector')
    const service = new TypedRetrievalService(sourceRepository, chunkRepository, { embedVariants })

    const result = await service.retrieve({ scenarioId: 'scenario_1', query: 'memory' })

    expect(result.memory).toEqual([])
    expect(result.trace).toEqual(
      expect.objectContaining({
        outcome: 'failed',
        failure: { code: 'query_embedding_failed', retryable: true },
      }),
    )
    expect(searchByVector).not.toHaveBeenCalled()
  })

  it('returns a controlled empty result when vector search fails', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository([
      source('memory_source', 'memory'),
    ])
    const chunkRepository = new InMemoryKnowledgeChunkRepository([], sourceRepository)
    vi.spyOn(chunkRepository, 'searchByVector').mockRejectedValue(new Error('programming failure'))
    const service = new TypedRetrievalService(sourceRepository, chunkRepository, {
      embedVariants: vi
        .fn()
        .mockResolvedValue(embeddingResult([{ source: 'direct_query', text: 'memory' }], [[1, 0]])),
    })

    await expect(service.retrieve({ scenarioId: 'scenario_1', query: 'memory' })).rejects.toThrow(
      'programming failure',
    )
  })

  it('maps the canonical vector search failure to an empty controlled result', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository([
      source('memory_source', 'memory'),
    ])
    const chunkRepository = new InMemoryKnowledgeChunkRepository([], sourceRepository)
    vi.spyOn(chunkRepository, 'searchByVector').mockRejectedValue(
      new KnowledgeVectorSearchError({ code: 'vector_search_failed', retryable: false }),
    )
    const service = new TypedRetrievalService(sourceRepository, chunkRepository, {
      embedVariants: vi
        .fn()
        .mockResolvedValue(embeddingResult([{ source: 'direct_query', text: 'memory' }], [[1, 0]])),
    })

    const result = await service.retrieve({ scenarioId: 'scenario_1', query: 'memory' })

    expect(result.trace.outcome).toBe('failed')
    expect(result.trace.failure?.code).toBe('vector_search_failed')
  })
})
