import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js'
import type { RetrievalQueryEmbeddingResult } from './knowledge-query-embedding.service.js'
import { TypedRetrievalService } from './typed-retrieval.service.js'
import { PostgresKnowledgeChunkRepository } from '../../../infrastructure/db/repositories/postgres-knowledge-chunk.repository.js'
import { PostgresKnowledgeCorpusRepository } from '../../../infrastructure/db/repositories/postgres-knowledge-corpus.repository.js'
import { PostgresKnowledgeSourceRepository } from '../../../infrastructure/db/repositories/postgres-knowledge-source.repository.js'
import { PostgresScenarioRepository } from '../../../infrastructure/db/repositories/postgres-scenario.repository.js'
import {
  DB_AVAILABLE,
  createTestSql,
  truncateAllTables,
} from '../../../infrastructure/db/test-helpers.js'

const profile = {
  provider: 'test-provider',
  model: 'test-retrieval',
  dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
}

function vector(first: number, second: number): number[] {
  return [first, second, ...Array.from({ length: profile.dimensions - 2 }, () => 0)]
}

describe.skipIf(!DB_AVAILABLE)('TypedRetrievalService with PostgreSQL retrieval', () => {
  let sql: Sql
  let scenarioRepository: PostgresScenarioRepository
  let sourceRepository: PostgresKnowledgeSourceRepository
  let chunkRepository: PostgresKnowledgeChunkRepository
  let corpusRepository: PostgresKnowledgeCorpusRepository

  beforeAll(() => {
    sql = createTestSql()
    scenarioRepository = new PostgresScenarioRepository(sql)
    sourceRepository = new PostgresKnowledgeSourceRepository(sql)
    chunkRepository = new PostgresKnowledgeChunkRepository(sql)
    corpusRepository = new PostgresKnowledgeCorpusRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('fuses a PostgreSQL lexical-only exact-entity match with vector candidates', async () => {
    const scenario = await scenarioRepository.create({
      name: 'Retrieval service integration',
      status: 'active',
      language: 'en',
    })
    const source = await sourceRepository.create({
      scenarioId: scenario.scenarioId,
      name: 'World clues',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: 'inline://retrieval',
      visibilityPolicy: 'all',
    })
    await sourceRepository.updateStatus(source.sourceId, 'ready')
    const persistedProfile = await corpusRepository.createEmbeddingProfile(profile)
    const operation = await corpusRepository.createReindexOperation({
      embeddingProfileId: persistedProfile.embeddingProfileId,
      sourceIds: [source.sourceId],
    })

    await chunkRepository.create({
      sourceId: source.sourceId,
      content: 'A generic clue without a named entity.',
      chunkIndex: 0,
      embedding: vector(0, 1),
      embeddingProfileId: operation.embeddingProfileId,
      corpusGenerationId: operation.corpusGenerationId,
    })
    await chunkRepository.create({
      sourceId: source.sourceId,
      content: 'Marquis de Lune keeps the key in the winter garden.',
      chunkIndex: 1,
      embedding: vector(1, 0),
      embeddingProfileId: operation.embeddingProfileId,
      corpusGenerationId: operation.corpusGenerationId,
    })
    await corpusRepository.updateReindexSourceProgress(
      operation.reindexOperationId,
      source.sourceId,
      {
        status: 'completed',
        expectedChunkCount: 2,
        completedChunkCount: 2,
      },
    )
    await corpusRepository.promoteCorpusGeneration(operation.reindexOperationId)

    const query = { source: 'direct_query' as const, text: 'Marquis de Lune', queryIndex: 0 }
    const embedding: RetrievalQueryEmbeddingResult = {
      queries: [query],
      queryVectors: [{ vector: vector(0, 1), variant: query, queryIndex: 0 }],
      diagnostics: {
        outcome: 'success',
        queryVectorCount: 1,
        embeddingProfile: {
          ...profile,
          embeddingProfileId: operation.embeddingProfileId,
          corpusGenerationId: operation.corpusGenerationId,
        },
        timings: { totalMs: 0 },
      },
    }
    const service = new TypedRetrievalService(sourceRepository, chunkRepository, {
      embedVariants: vi.fn().mockResolvedValue(embedding),
    })

    const result = await service.retrieve({
      scenarioId: scenario.scenarioId,
      query: query.text,
      limitPerType: 1,
    })

    expect(result.world).toHaveLength(1)
    expect(result.world[0]).toEqual(
      expect.objectContaining({
        content: 'Marquis de Lune keeps the key in the winter garden.',
        matchType: 'lexical',
        reason: 'lexical-match',
      }),
    )
    expect(result.trace.perType.world.selectedChunkIds).toHaveLength(1)
  })
})
