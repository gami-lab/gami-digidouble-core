import { describe, expect, it } from 'vitest'
import { DomainError } from '../../../domain/errors.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import { GetTypedRetrievalUseCase } from './get-typed-retrieval.use-case.js'
import type { RetrievalQueryEmbeddingResult } from '../../services/knowledge/knowledge-query-embedding.service.js'

function buildUseCase(): GetTypedRetrievalUseCase {
  const sourceRepo = new InMemoryKnowledgeSourceRepository([
    {
      sourceId: 'knowledge_source_1',
      scenarioId: 'scenario_1',
      name: 'Memory source',
      knowledgeType: 'avatar_knowledge',
      format: 'text',
      uriOrPath: '/memory.txt',
      status: 'ready',
      createdAt: '2026-05-11T10:00:00.000Z',
      updatedAt: '2026-05-11T10:00:00.000Z',
    },
    {
      sourceId: 'knowledge_source_world_avatar_1',
      scenarioId: 'scenario_1',
      name: 'Avatar one world',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/world.md',
      status: 'ready',
      visibleToAvatarIds: ['avatar_1'],
      createdAt: '2026-05-11T10:00:00.000Z',
      updatedAt: '2026-05-11T10:00:00.000Z',
    },
  ])
  const chunkRepo = new InMemoryKnowledgeChunkRepository(
    [
      {
        chunkId: 'knowledge_chunk_1',
        sourceId: 'knowledge_source_1',
        content: 'Budget preferences for user',
        chunkIndex: 0,
        embedding: [1, 0],
        embeddingProfileId: 'profile_1',
        corpusGenerationId: 'generation_1',
        createdAt: '2026-05-11T10:00:00.000Z',
        metadata: { userId: 'user_1' },
      },
      {
        chunkId: 'knowledge_chunk_world_avatar_1',
        sourceId: 'knowledge_source_world_avatar_1',
        content: 'restricted world lore',
        chunkIndex: 0,
        embedding: [0, 1],
        embeddingProfileId: 'profile_1',
        corpusGenerationId: 'generation_1',
        createdAt: '2026-05-11T10:00:00.000Z',
      },
    ],
    sourceRepo,
  )
  const embeddingResult: RetrievalQueryEmbeddingResult = {
    queries: [{ source: 'direct_query', text: 'query', queryIndex: 0 }],
    queryVectors: [
      {
        vector: [1, 0],
        variant: { source: 'direct_query', text: 'query', queryIndex: 0 },
        queryIndex: 0,
      },
    ],
    diagnostics: {
      outcome: 'success',
      queryVectorCount: 1,
      embeddingProfile: {
        embeddingProfileId: 'profile_1',
        corpusGenerationId: 'generation_1',
        provider: 'fake',
        model: 'fake',
        dimensions: 2,
      },
      timings: { totalMs: 1, queryEmbeddingMs: 1 },
    },
  }
  return new GetTypedRetrievalUseCase(
    new TypedRetrievalService(sourceRepo, chunkRepo, {
      embedVariants: (input) => {
        const vector = input.query?.includes('restricted') ? [0, 1] : [1, 0]
        const queryVector = embeddingResult.queryVectors[0]
        if (queryVector === undefined) return Promise.reject(new Error('Missing fake vector.'))
        return Promise.resolve({
          ...embeddingResult,
          queryVectors: [{ ...queryVector, vector }],
        })
      },
    }),
  )
}

describe('GetTypedRetrievalUseCase', () => {
  it('returns typed retrieval payload', async () => {
    const useCase = buildUseCase()

    const output = await useCase.execute({
      scenarioId: 'scenario_1',
      query: 'budget',
      userId: 'user_1',
    })

    expect(output.retrieval.avatar_knowledge).toHaveLength(1)
    expect(output.retrieval.world).toHaveLength(1)
    expect(output.retrieval.media).toHaveLength(0)
  })

  it('validates input', async () => {
    const useCase = buildUseCase()

    await expect(useCase.execute({ scenarioId: ' ', query: 'budget' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }),
    )
  })

  it('forwards activeAvatarId to enforce avatar visibility filtering', async () => {
    const useCase = buildUseCase()

    const visible = await useCase.execute({
      scenarioId: 'scenario_1',
      query: 'restricted',
      activeAvatarId: 'avatar_1',
    })
    const hidden = await useCase.execute({
      scenarioId: 'scenario_1',
      query: 'restricted',
      activeAvatarId: 'avatar_2',
    })

    expect(visible.retrieval.world).toHaveLength(1)
    expect(hidden.retrieval.world).toHaveLength(0)
    expect(hidden.retrieval.trace.perType.world.visibility?.activeAvatarId).toBe('avatar_2')
    expect(hidden.retrieval.trace.perType.world.visibility?.excludedChunkCount).toBe(0)
  })

  it('uses the unrestricted GM view when no active avatar is selected', async () => {
    const useCase = buildUseCase()

    const output = await useCase.execute({
      scenarioId: 'scenario_1',
      query: 'restricted',
    })

    expect(output.retrieval.world).toHaveLength(1)
    expect(output.retrieval.world[0]?.content).toBe('restricted world lore')
  })
})
