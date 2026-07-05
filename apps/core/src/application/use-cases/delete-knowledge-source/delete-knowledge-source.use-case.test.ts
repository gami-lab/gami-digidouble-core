import { describe, expect, it } from 'vitest'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { DeleteKnowledgeSourceUseCase } from './delete-knowledge-source.use-case.js'

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

describe('DeleteKnowledgeSourceUseCase', () => {
  it('throws NOT_FOUND when source does not exist', async () => {
    const useCase = new DeleteKnowledgeSourceUseCase(
      new InMemoryKnowledgeSourceRepository(),
      new InMemoryKnowledgeChunkRepository(),
    )

    await expect(useCase.execute({ sourceId: 'knowledge_source_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('deletes the source and its chunks', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository([makeSource()])
    const chunkRepository = new InMemoryKnowledgeChunkRepository()
    await chunkRepository.create({
      sourceId: 'knowledge_source_1',
      content: 'chunk one',
      chunkIndex: 0,
    })
    const useCase = new DeleteKnowledgeSourceUseCase(sourceRepository, chunkRepository)

    const output = await useCase.execute({ sourceId: 'knowledge_source_1' })

    expect(output).toEqual({ sourceId: 'knowledge_source_1', deleted: true })
    expect(await sourceRepository.findById('knowledge_source_1')).toBeNull()
    expect(await chunkRepository.listBySourceId('knowledge_source_1')).toEqual([])
  })
})
