import { describe, expect, it } from 'vitest'
import { DomainError } from '../../../domain/errors.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import { GetTypedRetrievalUseCase } from './get-typed-retrieval.use-case.js'

function buildUseCase(): GetTypedRetrievalUseCase {
  const sourceRepo = new InMemoryKnowledgeSourceRepository([
    {
      sourceId: 'knowledge_source_1',
      scenarioId: 'scenario_1',
      name: 'Memory source',
      knowledgeType: 'memory',
      format: 'text',
      uriOrPath: '/memory.txt',
      status: 'ready',
      createdAt: '2026-05-11T10:00:00.000Z',
      updatedAt: '2026-05-11T10:00:00.000Z',
    },
  ])
  const chunkRepo = new InMemoryKnowledgeChunkRepository([
    {
      chunkId: 'knowledge_chunk_1',
      sourceId: 'knowledge_source_1',
      content: 'Budget preferences for user',
      chunkIndex: 0,
      createdAt: '2026-05-11T10:00:00.000Z',
      metadata: { userId: 'user_1' },
    },
  ])
  return new GetTypedRetrievalUseCase(new TypedRetrievalService(sourceRepo, chunkRepo))
}

describe('GetTypedRetrievalUseCase', () => {
  it('returns typed retrieval payload', async () => {
    const useCase = buildUseCase()

    const output = await useCase.execute({
      scenarioId: 'scenario_1',
      query: 'budget',
      userId: 'user_1',
    })

    expect(output.retrieval.memory).toHaveLength(1)
    expect(output.retrieval.world).toHaveLength(0)
    expect(output.retrieval.media).toHaveLength(0)
  })

  it('validates input', async () => {
    const useCase = buildUseCase()

    await expect(useCase.execute({ scenarioId: ' ', query: 'budget' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }),
    )
  })
})
