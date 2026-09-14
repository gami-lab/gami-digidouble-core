import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type {
  EmbeddingBatchRequest,
  EmbeddingBatchResult,
  EmbeddingProfile,
  IEmbeddingAdapter,
} from '../../ports/IEmbeddingAdapter.js'
import type {
  IKnowledgeSourceContentLoader,
  LoadedKnowledgeSourceContent,
} from '../../ports/IKnowledgeSourceContentLoader.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryKnowledgeSourceContentLoader } from '../../../infrastructure/knowledge/in-memory-knowledge-source-content-loader.js'
import {
  DB_AVAILABLE,
  createTestSql,
  truncateAllTables,
} from '../../../infrastructure/db/test-helpers.js'
import { PostgresKnowledgeChunkRepository } from '../../../infrastructure/db/repositories/postgres-knowledge-chunk.repository.js'
import { PostgresKnowledgeCorpusRepository } from '../../../infrastructure/db/repositories/postgres-knowledge-corpus.repository.js'
import { PostgresKnowledgeSourceRepository } from '../../../infrastructure/db/repositories/postgres-knowledge-source.repository.js'
import { PostgresScenarioRepository } from '../../../infrastructure/db/repositories/postgres-scenario.repository.js'
import { KnowledgeReindexService } from './knowledge-reindex.service.js'

const profile: EmbeddingProfile = {
  provider: 'test-provider',
  model: 'test-reindex',
  dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
}

class CountingEmbeddingAdapter implements IEmbeddingAdapter {
  readonly requests: string[][] = []

  embed(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
    this.requests.push([...request.inputs])
    return Promise.resolve({
      vectors: request.inputs.map((_input, index) => {
        const vector = new Array<number>(profile.dimensions).fill(0)
        vector[index] = 1
        return vector
      }),
      metadata: { profile, inputCount: request.inputs.length, batchCount: 1 },
    })
  }
}

class BlockingContentLoader implements IKnowledgeSourceContentLoader {
  private readonly delegate = new InMemoryKnowledgeSourceContentLoader()
  private gate:
    | {
        entered: () => void
        released: Promise<void>
      }
    | undefined

  blockNext(): { entered: Promise<void>; release: () => void } {
    let enteredResolve!: () => void
    let releaseResolve!: () => void
    const entered = new Promise<void>((resolve) => {
      enteredResolve = resolve
    })
    const released = new Promise<void>((resolve) => {
      releaseResolve = resolve
    })
    this.gate = { entered: enteredResolve, released }
    return { entered, release: releaseResolve }
  }

  async load(source: KnowledgeSource): Promise<LoadedKnowledgeSourceContent> {
    const loaded = await this.delegate.load(source)
    const gate = this.gate
    if (gate === undefined) return loaded
    this.gate = undefined
    gate.entered()
    await gate.released
    return loaded
  }
}

// eslint-disable-next-line max-lines-per-function
describe.skipIf(!DB_AVAILABLE)('KnowledgeReindexService with PostgreSQL persistence', () => {
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

  it('keeps the old corpus readable while staging and reuses unchanged source vectors', async () => {
    const scenario = await scenarioRepository.create({
      name: 'Reindex service integration',
      status: 'active',
      language: 'en',
    })
    const stableSource = await sourceRepository.create({
      scenarioId: scenario.scenarioId,
      name: 'Stable source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: 'inline://stable',
      metadata: { inlineText: 'Stable source content.' },
      visibilityPolicy: 'all',
    })
    const changedSource = await sourceRepository.create({
      scenarioId: scenario.scenarioId,
      name: 'Changed source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: 'inline://changed',
      metadata: { inlineText: 'Original changed-source content.' },
      visibilityPolicy: 'all',
    })
    await sourceRepository.updateStatus(stableSource.sourceId, 'ready')
    await sourceRepository.updateStatus(changedSource.sourceId, 'ready')

    const adapter = new CountingEmbeddingAdapter()
    const loader = new BlockingContentLoader()
    const events = new InMemoryEventLogRepository()
    const service = new KnowledgeReindexService(
      sourceRepository,
      corpusRepository,
      loader,
      adapter,
      events,
      profile,
    )

    const initial = await service.start()
    expect(initial.operation).not.toBeNull()
    await service.run(initial.operation?.reindexOperationId ?? '')
    expect(adapter.requests).toHaveLength(2)
    await expect(chunkRepository.listBySourceId(changedSource.sourceId)).resolves.toMatchObject([
      { content: 'Original changed-source content.' },
    ])

    await sourceRepository.update(changedSource.sourceId, {
      metadata: { inlineText: 'Updated changed-source content.' },
    })
    const gate = loader.blockNext()
    const replacement = await service.start()
    expect(replacement.status).toBe('started')
    const replacementRun = service.run(replacement.operation?.reindexOperationId ?? '')
    await gate.entered

    await expect(chunkRepository.listBySourceId(stableSource.sourceId)).resolves.toMatchObject([
      { content: 'Stable source content.' },
    ])
    await expect(chunkRepository.listBySourceId(changedSource.sourceId)).resolves.toMatchObject([
      { content: 'Original changed-source content.' },
    ])

    gate.release()
    await replacementRun

    expect(adapter.requests).toHaveLength(3)
    expect(adapter.requests[2]).toHaveLength(1)
    await expect(chunkRepository.listBySourceId(changedSource.sourceId)).resolves.toMatchObject([
      { content: 'Updated changed-source content.' },
    ])
    const progress = await corpusRepository.listReindexSourceProgress(
      replacement.operation?.reindexOperationId ?? '',
    )
    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: stableSource.sourceId,
          embeddedChunkCount: 0,
          reusedChunkCount: 1,
        }),
        expect.objectContaining({
          sourceId: changedSource.sourceId,
          embeddedChunkCount: 1,
          reusedChunkCount: 0,
        }),
      ]),
    )
    expect(events.getAll().at(-1)?.payload).toEqual(
      expect.objectContaining({ embeddedChunkCount: 1, reusedChunkCount: 1 }),
    )
  })
})
