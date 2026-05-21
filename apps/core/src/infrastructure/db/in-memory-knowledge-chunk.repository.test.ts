import { describe, expect, it } from 'vitest'
import type { KnowledgeChunk } from '../../domain/knowledge/knowledge.types.js'
import { InMemoryKnowledgeChunkRepository } from './in-memory-knowledge-chunk.repository.js'

function makeChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    chunkId: 'knowledge_chunk_1',
    sourceId: 'knowledge_source_1',
    content: 'Chunk content',
    chunkIndex: 0,
    createdAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryKnowledgeChunkRepository', () => {
  it('creates and lists chunks ordered by chunkIndex', async () => {
    const repository = new InMemoryKnowledgeChunkRepository([
      makeChunk({ chunkId: 'knowledge_chunk_b', chunkIndex: 2 }),
      makeChunk({ chunkId: 'knowledge_chunk_a', chunkIndex: 1 }),
    ])

    await repository.create({
      sourceId: 'knowledge_source_1',
      content: 'Zero',
      chunkIndex: 0,
      embedding: [0.1, 0.2],
    })

    const chunks = await repository.listBySourceId('knowledge_source_1')

    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1, 2])
    expect(chunks[0]?.embedding).toEqual([0.1, 0.2])
    expect(chunks[0]?.visibleToAvatarIds).toBeUndefined()
  })

  it('stores explicit visibleToAvatarIds and normalizes empty lists to default visibility', async () => {
    const repository = new InMemoryKnowledgeChunkRepository()
    const sourceId = 'knowledge_source_1'

    const visible = await repository.create({
      sourceId,
      content: 'Visible to selected avatars',
      chunkIndex: 0,
      visibleToAvatarIds: ['avatar_1', ' avatar_2 '],
    })
    const publicByEmpty = await repository.create({
      sourceId,
      content: 'Visible to all',
      chunkIndex: 1,
      visibleToAvatarIds: [],
    })

    expect(visible.visibleToAvatarIds).toEqual(['avatar_1', 'avatar_2'])
    expect(publicByEmpty.visibleToAvatarIds).toBeUndefined()
  })

  it('deleteBySourceId removes only matching source chunks', async () => {
    const repository = new InMemoryKnowledgeChunkRepository([
      makeChunk({ chunkId: 'knowledge_chunk_1', sourceId: 'knowledge_source_1' }),
      makeChunk({ chunkId: 'knowledge_chunk_2', sourceId: 'knowledge_source_1' }),
      makeChunk({ chunkId: 'knowledge_chunk_3', sourceId: 'knowledge_source_2' }),
    ])

    const deleted = await repository.deleteBySourceId('knowledge_source_1')
    const remaining = await repository.listBySourceId('knowledge_source_2')

    expect(deleted).toBe(2)
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.chunkId).toBe('knowledge_chunk_3')
  })

  it('listBySourceIds returns chunks from provided source ids only', async () => {
    const repository = new InMemoryKnowledgeChunkRepository([
      makeChunk({ chunkId: 'knowledge_chunk_1', sourceId: 'knowledge_source_1', chunkIndex: 1 }),
      makeChunk({ chunkId: 'knowledge_chunk_2', sourceId: 'knowledge_source_2', chunkIndex: 0 }),
      makeChunk({ chunkId: 'knowledge_chunk_3', sourceId: 'knowledge_source_1', chunkIndex: 0 }),
    ])

    const selected = await repository.listBySourceIds(['knowledge_source_1'])

    expect(selected.map((chunk) => chunk.chunkId)).toEqual([
      'knowledge_chunk_3',
      'knowledge_chunk_1',
    ])
  })
})
