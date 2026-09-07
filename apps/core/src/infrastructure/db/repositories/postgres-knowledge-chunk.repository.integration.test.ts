import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  DB_AVAILABLE,
  createTestSql,
  ensureSchemaAlignment,
  truncateAllTables,
} from '../test-helpers.js'
import { PostgresKnowledgeChunkRepository } from './postgres-knowledge-chunk.repository.js'
import { PostgresKnowledgeCorpusRepository } from './postgres-knowledge-corpus.repository.js'
import { PostgresKnowledgeSourceRepository } from './postgres-knowledge-source.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

function vector16(first: number, second: number): number[] {
  return [first, second, ...Array.from({ length: 14 }, () => 0)]
}

// eslint-disable-next-line max-lines-per-function
describe.skipIf(!DB_AVAILABLE)('PostgresKnowledgeChunkRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sourceRepo: PostgresKnowledgeSourceRepository
  let corpusRepo: PostgresKnowledgeCorpusRepository
  let chunkRepo: PostgresKnowledgeChunkRepository
  let sourceId: string

  beforeAll(async () => {
    sql = createTestSql()
    await ensureSchemaAlignment(sql)
    scenarioRepo = new PostgresScenarioRepository(sql)
    sourceRepo = new PostgresKnowledgeSourceRepository(sql)
    corpusRepo = new PostgresKnowledgeCorpusRepository(sql)
    chunkRepo = new PostgresKnowledgeChunkRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  async function seedSource(): Promise<void> {
    const scenario = await scenarioRepo.create({ name: 'Chunk scenario', status: 'active' })
    const source = await sourceRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Chunk source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/chunks.txt',
    })
    sourceId = source.sourceId
  }

  it('creates and lists chunks ordered by chunk index', async () => {
    await seedSource()
    const profile = await corpusRepo.createEmbeddingProfile({
      provider: 'test',
      model: 'test-embedding',
      dimensions: 16,
    })
    const operation = await corpusRepo.createReindexOperation({
      embeddingProfileId: profile.embeddingProfileId,
      sourceIds: [sourceId],
    })

    await chunkRepo.create({
      sourceId,
      content: 'Chunk 2',
      chunkIndex: 2,
      embedding: vector16(0.2, 0.3),
      embeddingProfileId: profile.embeddingProfileId,
      corpusGenerationId: operation.corpusGenerationId,
    })
    await chunkRepo.create({
      sourceId,
      content: 'Chunk 0',
      chunkIndex: 0,
      embedding: vector16(0.1, 0.0),
      embeddingProfileId: profile.embeddingProfileId,
      corpusGenerationId: operation.corpusGenerationId,
    })

    await corpusRepo.updateReindexSourceProgress(operation.reindexOperationId, sourceId, {
      status: 'completed',
      expectedChunkCount: 2,
      completedChunkCount: 2,
    })
    expect((await corpusRepo.validateCorpusGeneration(operation.reindexOperationId)).valid).toBe(
      true,
    )
    await corpusRepo.promoteCorpusGeneration(operation.reindexOperationId)

    const chunks = await chunkRepo.listBySourceId(sourceId)

    expect(chunks).toHaveLength(2)
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 2])
    expect(chunks[0]?.embedding).toEqual(vector16(0.1, 0))
    expect(chunks[0]?.visibleToAvatarIds).toBeUndefined()
  })

  it('persists explicit visibleToAvatarIds and keeps empty list as default visibility', async () => {
    await seedSource()

    await chunkRepo.create({
      sourceId,
      content: 'Private chunk',
      chunkIndex: 0,
      visibleToAvatarIds: ['avatar_1', 'avatar_2'],
    })
    await chunkRepo.create({
      sourceId,
      content: 'Public chunk',
      chunkIndex: 1,
      visibleToAvatarIds: [],
    })

    const chunks = await chunkRepo.listBySourceId(sourceId)
    expect(chunks[0]?.visibleToAvatarIds).toEqual(['avatar_1', 'avatar_2'])
    expect(chunks[1]?.visibleToAvatarIds).toBeUndefined()
  })

  it('deleteBySourceId returns deleted row count', async () => {
    await seedSource()

    await chunkRepo.create({ sourceId, content: 'A', chunkIndex: 0 })
    await chunkRepo.create({ sourceId, content: 'B', chunkIndex: 1 })

    const deleted = await chunkRepo.deleteBySourceId(sourceId)
    const remaining = await chunkRepo.listBySourceId(sourceId)

    expect(deleted).toBe(2)
    expect(remaining).toHaveLength(0)
  })

  it('listBySourceIds returns chunks from selected sources only', async () => {
    await seedSource()
    const scenario = await scenarioRepo.create({ name: 'Chunk scenario 2', status: 'active' })
    const secondSource = await sourceRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Chunk source 2',
      knowledgeType: 'media',
      format: 'media',
      uriOrPath: '/tmp/media.png',
    })

    await chunkRepo.create({ sourceId, content: 'World chunk', chunkIndex: 0 })
    await chunkRepo.create({
      sourceId: secondSource.sourceId,
      content: 'Media chunk',
      chunkIndex: 0,
    })

    const selected = await chunkRepo.listBySourceIds([secondSource.sourceId])

    expect(selected).toHaveLength(1)
    expect(selected[0]?.sourceId).toBe(secondSource.sourceId)
  })
})
