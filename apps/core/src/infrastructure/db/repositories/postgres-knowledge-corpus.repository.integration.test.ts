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
describe.skipIf(!DB_AVAILABLE)('PostgresKnowledgeCorpusRepository', () => {
  let sql: Sql
  let scenarioRepository: PostgresScenarioRepository
  let sourceRepository: PostgresKnowledgeSourceRepository
  let corpusRepository: PostgresKnowledgeCorpusRepository
  let chunkRepository: PostgresKnowledgeChunkRepository

  beforeAll(async () => {
    sql = createTestSql()
    await ensureSchemaAlignment(sql)
    scenarioRepository = new PostgresScenarioRepository(sql)
    sourceRepository = new PostgresKnowledgeSourceRepository(sql)
    corpusRepository = new PostgresKnowledgeCorpusRepository(sql)
    chunkRepository = new PostgresKnowledgeChunkRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  async function seedSources(): Promise<[string, string]> {
    const scenario = await scenarioRepository.create({ name: 'Corpus scenario', status: 'active' })
    const first = await sourceRepository.create({
      scenarioId: scenario.scenarioId,
      name: 'First source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/first.txt',
    })
    const second = await sourceRepository.create({
      scenarioId: scenario.scenarioId,
      name: 'Second source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/second.txt',
    })
    return [first.sourceId, second.sourceId]
  }

  it('isolates staging and atomically promotes a complete generation', async () => {
    const [firstSource, secondSource] = await seedSources()
    const profile = await corpusRepository.createEmbeddingProfile({
      provider: 'test',
      model: 'test-embedding',
      dimensions: 16,
    })
    const operation = await corpusRepository.createReindexOperation({
      embeddingProfileId: profile.embeddingProfileId,
      sourceIds: [firstSource, secondSource],
    })

    await corpusRepository.replaceStagedSourceChunks(operation.reindexOperationId, firstSource, [
      {
        sourceId: firstSource,
        content: 'first',
        chunkIndex: 0,
        embedding: vector16(1, 0),
        embeddingProfileId: operation.embeddingProfileId,
        corpusGenerationId: operation.corpusGenerationId,
      },
    ])
    await expect(chunkRepository.listBySourceId(firstSource)).resolves.toEqual([])
    await expect(
      corpusRepository.promoteCorpusGeneration(operation.reindexOperationId),
    ).rejects.toThrow('validation failed')
    await expect(corpusRepository.getActiveCorpus()).resolves.toBeNull()

    await corpusRepository.replaceStagedSourceChunks(operation.reindexOperationId, secondSource, [
      {
        sourceId: secondSource,
        content: 'second',
        chunkIndex: 0,
        embedding: vector16(0, 1),
        embeddingProfileId: operation.embeddingProfileId,
        corpusGenerationId: operation.corpusGenerationId,
      },
    ])
    await corpusRepository.promoteCorpusGeneration(operation.reindexOperationId)

    await expect(
      chunkRepository.listBySourceIds([firstSource, secondSource]),
    ).resolves.toMatchObject([{ content: 'first' }, { content: 'second' }])
  })

  it('rejects unprofiled vectors and preserves the prior active generation on failure', async () => {
    const [firstSource] = await seedSources()
    await expect(
      chunkRepository.create({
        sourceId: firstSource,
        content: 'legacy vector',
        chunkIndex: 0,
        embedding: vector16(1, 0),
      }),
    ).rejects.toThrow('require an embedding profile')

    const profile = await corpusRepository.createEmbeddingProfile({
      provider: 'test',
      model: 'test-embedding',
      dimensions: 16,
    })
    const firstOperation = await corpusRepository.createReindexOperation({
      embeddingProfileId: profile.embeddingProfileId,
      sourceIds: [firstSource],
    })
    await corpusRepository.replaceStagedSourceChunks(
      firstOperation.reindexOperationId,
      firstSource,
      [
        {
          sourceId: firstSource,
          content: 'active',
          chunkIndex: 0,
          embedding: vector16(1, 0),
          embeddingProfileId: firstOperation.embeddingProfileId,
          corpusGenerationId: firstOperation.corpusGenerationId,
        },
      ],
    )
    await corpusRepository.promoteCorpusGeneration(firstOperation.reindexOperationId)

    const failedOperation = await corpusRepository.createReindexOperation({
      embeddingProfileId: profile.embeddingProfileId,
      sourceIds: [firstSource],
    })
    await expect(
      corpusRepository.promoteCorpusGeneration(failedOperation.reindexOperationId),
    ).rejects.toThrow('validation failed')
    await expect(chunkRepository.listBySourceId(firstSource)).resolves.toMatchObject([
      { content: 'active' },
    ])
  })

  it('publishes an active source replacement transactionally and rejects stale snapshots', async () => {
    const [firstSource] = await seedSources()
    const profile = await corpusRepository.createEmbeddingProfile({
      provider: 'test',
      model: 'test-embedding',
      dimensions: 16,
    })
    const operation = await corpusRepository.createReindexOperation({
      embeddingProfileId: profile.embeddingProfileId,
      sourceIds: [firstSource],
    })
    await corpusRepository.replaceStagedSourceChunks(operation.reindexOperationId, firstSource, [
      {
        sourceId: firstSource,
        content: 'active',
        chunkIndex: 0,
        embedding: vector16(1, 0),
        embeddingProfileId: operation.embeddingProfileId,
        corpusGenerationId: operation.corpusGenerationId,
      },
    ])
    await corpusRepository.promoteCorpusGeneration(operation.reindexOperationId)

    await expect(
      corpusRepository.replaceActiveSourceChunks({
        sourceId: firstSource,
        embeddingProfileId: operation.embeddingProfileId,
        corpusGenerationId: operation.corpusGenerationId,
        chunks: [
          {
            sourceId: firstSource,
            content: 'replacement',
            chunkIndex: 0,
            embedding: vector16(0, 1),
            embeddingProfileId: operation.embeddingProfileId,
            corpusGenerationId: operation.corpusGenerationId,
          },
        ],
      }),
    ).resolves.toBe(1)
    await expect(chunkRepository.listBySourceId(firstSource)).resolves.toMatchObject([
      { content: 'replacement' },
    ])

    await expect(
      corpusRepository.replaceActiveSourceChunks({
        sourceId: firstSource,
        embeddingProfileId: operation.embeddingProfileId,
        corpusGenerationId: 'corpus_generation_00000000-0000-0000-0000-000000000000',
        chunks: [
          {
            sourceId: firstSource,
            content: 'stale replacement',
            chunkIndex: 0,
            embedding: vector16(0, 1),
            embeddingProfileId: operation.embeddingProfileId,
            corpusGenerationId: 'corpus_generation_00000000-0000-0000-0000-000000000000',
          },
        ],
      }),
    ).rejects.toThrow('changed')
    await expect(chunkRepository.listBySourceId(firstSource)).resolves.toMatchObject([
      { content: 'replacement' },
    ])
  })

  it('claims one worker and recovers an interrupted operation for retry', async () => {
    const [firstSource] = await seedSources()
    const profile = await corpusRepository.createEmbeddingProfile({
      provider: 'test',
      model: 'test-embedding',
      dimensions: 16,
    })
    const operation = await corpusRepository.createReindexOperation({
      embeddingProfileId: profile.embeddingProfileId,
      sourceIds: [firstSource],
    })

    const claims = await Promise.all([
      corpusRepository.claimReindexOperation(operation.reindexOperationId),
      corpusRepository.claimReindexOperation(operation.reindexOperationId),
    ])
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1)
    await expect(corpusRepository.recoverRunningReindexOperations()).resolves.toEqual([
      operation.reindexOperationId,
    ])
    await expect(
      corpusRepository.findReindexOperation(operation.reindexOperationId),
    ).resolves.toMatchObject({
      status: 'failed',
      attempts: 1,
    })
  })
})
