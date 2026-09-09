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

  async function activateVectorCorpus(
    sourceIds: string[],
    chunksBySource: Map<string, Array<{ content: string; chunkIndex: number; vector: number[] }>>,
  ): Promise<{ profileId: string; generationId: string }> {
    const profile = await corpusRepo.createEmbeddingProfile({
      provider: 'test',
      model: 'test-embedding',
      dimensions: 16,
    })
    const operation = await corpusRepo.createReindexOperation({
      embeddingProfileId: profile.embeddingProfileId,
      sourceIds,
    })

    for (const currentSourceId of sourceIds) {
      await sourceRepo.updateStatus(currentSourceId, 'ready')
      const sourceChunks = chunksBySource.get(currentSourceId) ?? []
      for (const chunk of sourceChunks) {
        await chunkRepo.create({
          sourceId: currentSourceId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          embedding: chunk.vector,
          embeddingProfileId: operation.embeddingProfileId,
          corpusGenerationId: operation.corpusGenerationId,
        })
      }
      await corpusRepo.updateReindexSourceProgress(operation.reindexOperationId, currentSourceId, {
        status: 'completed',
        expectedChunkCount: sourceChunks.length,
        completedChunkCount: sourceChunks.length,
      })
    }
    await corpusRepo.promoteCorpusGeneration(operation.reindexOperationId)
    return {
      profileId: profile.embeddingProfileId,
      generationId: operation.corpusGenerationId,
    }
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

  it('returns nearest candidates in cosine order and applies the candidate limit', async () => {
    await seedSource()
    const active = await activateVectorCorpus(
      [sourceId],
      new Map([
        [
          sourceId,
          [
            { content: 'far', chunkIndex: 2, vector: vector16(0, 1) },
            { content: 'near', chunkIndex: 1, vector: vector16(1, 0.1) },
            { content: 'best', chunkIndex: 0, vector: vector16(1, 0) },
          ],
        ],
      ]),
    )
    const source = await sourceRepo.findById(sourceId)
    expect(source).not.toBeNull()

    const candidates = await chunkRepo.searchByVector({
      queryVector: vector16(1, 0),
      queryVariant: { source: 'direct_query', text: 'find best' },
      scenarioId: source?.scenarioId ?? 'scenario_missing',
      knowledgeType: 'world',
      candidateLimit: 2,
      embeddingProfileId: active.profileId,
      corpusGenerationId: active.generationId,
      profile: { provider: 'test', model: 'test-embedding', dimensions: 16 },
      visibilityMode: 'avatar_filtered',
    })

    expect(candidates.map((candidate) => candidate.content)).toEqual(['best', 'near'])
    expect(candidates[0]?.distance).toBe(0)
    expect(candidates[0]?.similarity).toBe(1)
    expect(candidates[0]).not.toHaveProperty('embedding')
  })

  it('filters ready sources, type, scenario, profile, generation, static scope, and visibility', async () => {
    const scenario = await scenarioRepo.create({ name: 'Vector scenario', status: 'active' })
    const otherScenario = await scenarioRepo.create({ name: 'Other scenario', status: 'active' })
    const publicSource = await sourceRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Public',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/public.txt',
      visibilityPolicy: 'all',
    })
    const privateSource = await sourceRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Private',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/private.txt',
      visibilityPolicy: 'avatars',
      visibleToAvatarIds: ['avatar_1'],
    })
    const hiddenSource = await sourceRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Hidden',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/hidden.txt',
      visibilityPolicy: 'none',
    })
    const pendingSource = await sourceRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Pending',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/pending.txt',
    })
    const otherScenarioSource = await sourceRepo.create({
      scenarioId: otherScenario.scenarioId,
      name: 'Other scenario',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/other.txt',
    })
    const mediaSource = await sourceRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Media',
      knowledgeType: 'media',
      format: 'media',
      uriOrPath: '/tmp/media.png',
    })
    const sourceIds = [
      publicSource.sourceId,
      privateSource.sourceId,
      hiddenSource.sourceId,
      pendingSource.sourceId,
      otherScenarioSource.sourceId,
      mediaSource.sourceId,
    ]
    const active = await activateVectorCorpus(
      sourceIds,
      new Map(
        sourceIds.map((currentSourceId) => [
          currentSourceId,
          [{ content: currentSourceId, chunkIndex: 0, vector: vector16(1, 0) }],
        ]),
      ),
    )
    await sourceRepo.updateStatus(pendingSource.sourceId, 'pending')

    const baseRequest = {
      queryVector: vector16(1, 0),
      queryVariant: { source: 'world_context' as const, text: 'world' },
      scenarioId: scenario.scenarioId,
      knowledgeType: 'world' as const,
      candidateLimit: 10,
      embeddingProfileId: active.profileId,
      corpusGenerationId: active.generationId,
      profile: { provider: 'test', model: 'test-embedding', dimensions: 16 },
    }
    const filtered = await chunkRepo.searchByVector({
      ...baseRequest,
      visibilityMode: 'avatar_filtered',
      activeAvatarId: 'avatar_1',
    })
    const missingAvatar = await chunkRepo.searchByVector({
      ...baseRequest,
      visibilityMode: 'avatar_filtered',
    })
    const scoped = await chunkRepo.searchByVector({
      ...baseRequest,
      visibilityMode: 'gm_unrestricted',
      eligibleSourceIds: [hiddenSource.sourceId],
    })

    expect(filtered.map((candidate) => candidate.content)).toEqual(
      [publicSource.sourceId, privateSource.sourceId].sort((left, right) =>
        left.localeCompare(right),
      ),
    )
    expect(missingAvatar.map((candidate) => candidate.content)).toEqual([publicSource.sourceId])
    expect(scoped.map((candidate) => candidate.content)).toEqual([hiddenSource.sourceId])
  })

  it('rejects wrong dimensions and stale active profile identities without exposing vectors', async () => {
    await seedSource()
    const active = await activateVectorCorpus(
      [sourceId],
      new Map([[sourceId, [{ content: 'vector', chunkIndex: 0, vector: vector16(1, 0) }]]]),
    )
    const source = await sourceRepo.findById(sourceId)
    const request = {
      queryVector: vector16(1, 0),
      queryVariant: { source: 'direct_query' as const, text: 'vector' },
      scenarioId: source?.scenarioId ?? 'scenario_missing',
      knowledgeType: 'world' as const,
      candidateLimit: 2,
      embeddingProfileId: active.profileId,
      corpusGenerationId: active.generationId,
      profile: { provider: 'test', model: 'test-embedding', dimensions: 16 },
      visibilityMode: 'avatar_filtered' as const,
    }

    await expect(
      chunkRepo.searchByVector({ ...request, queryVector: [1, 2] }),
    ).rejects.toMatchObject({
      failure: { code: 'incompatible_dimension' },
    })
    const staleProfileError = await chunkRepo
      .searchByVector({
        ...request,
        embeddingProfileId: 'embedding_profile_00000000-0000-0000-0000-000000000000',
      })
      .catch((error: unknown) => error)
    expect(staleProfileError).toMatchObject({ failure: { code: 'incompatible_profile' } })
    expect(JSON.stringify(staleProfileError)).not.toContain('1,0')
  })

  it('keeps the nearest-neighbor query shape compatible with the cosine index', async () => {
    const queryVector = JSON.stringify(vector16(1, 0))
    const plan = await sql<{ 'QUERY PLAN': string }[]>`
      EXPLAIN (COSTS OFF)
      SELECT c.id
      FROM knowledge_chunks c
      WHERE c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${queryVector}::vector
      LIMIT 5
    `
    const planText = plan.map((row) => row['QUERY PLAN']).join('\n')

    expect(planText).toContain('embedding <=>')
    expect(planText).toContain('Limit')
  })
})
