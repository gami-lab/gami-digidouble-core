import { describe, expect, it } from 'vitest'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { ListKnowledgeChunksUseCase } from './list-knowledge-chunks.use-case.js'

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: 'knowledge_source_1',
    scenarioId: 'scenario_1',
    name: 'Lore',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: '/tmp/lore.txt',
    status: 'ready',
    createdAt: '2026-05-11T08:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

describe('ListKnowledgeChunksUseCase', () => {
  it('returns chunks for a source ordered by chunkIndex', async () => {
    const chunkRepository = new InMemoryKnowledgeChunkRepository()
    await chunkRepository.create({
      sourceId: 'knowledge_source_1',
      content: 'second',
      chunkIndex: 1,
    })
    await chunkRepository.create({
      sourceId: 'knowledge_source_1',
      content: 'first',
      chunkIndex: 0,
    })
    const useCase = new ListKnowledgeChunksUseCase(
      new InMemoryKnowledgeSourceRepository([makeSource()]),
      chunkRepository,
    )

    const output = await useCase.execute({ sourceId: 'knowledge_source_1' })

    expect(output.chunks.map((chunk) => chunk.content)).toEqual(['first', 'second'])
  })

  it('rejects an empty sourceId', async () => {
    const useCase = new ListKnowledgeChunksUseCase(
      new InMemoryKnowledgeSourceRepository(),
      new InMemoryKnowledgeChunkRepository(),
    )

    await expect(useCase.execute({ sourceId: '  ' })).rejects.toThrow(
      'sourceId must be a non-empty string.',
    )
  })

  it('throws NOT_FOUND when the source does not exist', async () => {
    const useCase = new ListKnowledgeChunksUseCase(
      new InMemoryKnowledgeSourceRepository(),
      new InMemoryKnowledgeChunkRepository(),
    )

    await expect(useCase.execute({ sourceId: 'missing' })).rejects.toThrow(
      'Knowledge source missing not found.',
    )
  })
})
