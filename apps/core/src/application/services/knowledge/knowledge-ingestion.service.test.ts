import { describe, expect, it } from 'vitest'
import { InMemoryIngestionJobRepository } from '../../../infrastructure/db/in-memory-ingestion-job.repository.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { HashEmbeddingAdapter } from '../../../infrastructure/knowledge/hash-embedding.adapter.js'
import type { IKnowledgeChunkRepository } from '../../ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeSourceContentLoader } from '../../ports/IKnowledgeSourceContentLoader.js'
import { KnowledgeIngestionService } from './knowledge-ingestion.service.js'

class StubLoader implements IKnowledgeSourceContentLoader {
  constructor(
    private readonly content: string,
    private readonly fail = false,
  ) {}

  load(): Promise<{ content: string; metadata?: Record<string, unknown> }> {
    if (this.fail) {
      return Promise.reject(new Error('load failed'))
    }
    return Promise.resolve({ content: this.content, metadata: { origin: 'stub' } })
  }
}

class FlakyChunkRepository implements IKnowledgeChunkRepository {
  private readonly inner: InMemoryKnowledgeChunkRepository
  private createCalls = 0

  constructor(initialData: ConstructorParameters<typeof InMemoryKnowledgeChunkRepository>[0] = []) {
    this.inner = new InMemoryKnowledgeChunkRepository(initialData)
  }

  async create(
    params: Parameters<InMemoryKnowledgeChunkRepository['create']>[0],
  ): Promise<Awaited<ReturnType<InMemoryKnowledgeChunkRepository['create']>>> {
    this.createCalls += 1
    if (this.createCalls === 2) {
      throw new Error('chunk write failed')
    }

    return this.inner.create(params)
  }

  listBySourceId(
    sourceId: string,
  ): Promise<Awaited<ReturnType<InMemoryKnowledgeChunkRepository['listBySourceId']>>> {
    return this.inner.listBySourceId(sourceId)
  }

  listBySourceIds(
    sourceIds: string[],
  ): Promise<Awaited<ReturnType<InMemoryKnowledgeChunkRepository['listBySourceIds']>>> {
    return this.inner.listBySourceIds(sourceIds)
  }

  deleteBySourceId(sourceId: string): Promise<number> {
    return this.inner.deleteBySourceId(sourceId)
  }
}

function createDefaultIngestionDeps(): {
  sourceRepository: InMemoryKnowledgeSourceRepository
  chunkRepository: InMemoryKnowledgeChunkRepository
  jobRepository: InMemoryIngestionJobRepository
  eventLogRepository: InMemoryEventLogRepository
} {
  return {
    sourceRepository: new InMemoryKnowledgeSourceRepository(),
    chunkRepository: new InMemoryKnowledgeChunkRepository(),
    jobRepository: new InMemoryIngestionJobRepository(),
    eventLogRepository: new InMemoryEventLogRepository(),
  }
}

describe('KnowledgeIngestionService — completion flow', () => {
  it('processes text source into persisted chunks with completed job status', async () => {
    const { sourceRepository, chunkRepository, jobRepository, eventLogRepository } =
      createDefaultIngestionDeps()

    const source = await sourceRepository.create({
      scenarioId: 'scenario_1',
      name: 'Rules',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/rules.txt',
      metadata: { inlineText: 'A\n\nB\n\nC' },
      visibleToAvatarIds: ['avatar_memory_1'],
    })
    const job = await jobRepository.create({ sourceId: source.sourceId, status: 'queued' })

    const service = new KnowledgeIngestionService(
      sourceRepository,
      chunkRepository,
      jobRepository,
      new StubLoader('A\n\nB\n\nC'),
      new HashEmbeddingAdapter(),
      eventLogRepository,
    )

    const result = await service.execute({
      sourceId: source.sourceId,
      ingestionJobId: job.ingestionJobId,
      correlationId: 'corr_1',
    })

    expect(result.status).toBe('completed')
    if (result.status === 'completed') {
      expect(result.chunkCount).toBe(1)
    }

    const updatedJob = await jobRepository.findById(job.ingestionJobId)
    const updatedSource = await sourceRepository.findById(source.sourceId)
    const chunks = await chunkRepository.listBySourceId(source.sourceId)

    expect(updatedJob?.status).toBe('completed')
    expect(updatedJob?.attempts).toBe(1)
    expect(updatedSource?.status).toBe('ready')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.embedding?.length).toBe(16)
    expect(chunks[0]?.visibleToAvatarIds).toEqual(['avatar_memory_1'])
  })
})

describe('KnowledgeIngestionService — failure and retry behavior', () => {
  it('marks job as failed and supports deterministic retry idempotency', async () => {
    const { sourceRepository, chunkRepository, jobRepository, eventLogRepository } =
      createDefaultIngestionDeps()

    const source = await sourceRepository.create({
      scenarioId: 'scenario_1',
      name: 'Guide',
      knowledgeType: 'memory',
      format: 'markdown',
      uriOrPath: '/tmp/guide.md',
    })
    const job = await jobRepository.create({ sourceId: source.sourceId, status: 'queued' })

    const failingService = new KnowledgeIngestionService(
      sourceRepository,
      chunkRepository,
      jobRepository,
      new StubLoader('', true),
      new HashEmbeddingAdapter(),
      eventLogRepository,
    )

    const failed = await failingService.execute({
      sourceId: source.sourceId,
      ingestionJobId: job.ingestionJobId,
    })

    expect(failed.status).toBe('failed')
    expect((await jobRepository.findById(job.ingestionJobId))?.status).toBe('failed')

    const retryJob = await jobRepository.create({ sourceId: source.sourceId, status: 'queued' })
    const successService = new KnowledgeIngestionService(
      sourceRepository,
      chunkRepository,
      jobRepository,
      new StubLoader('First\n\nSecond'),
      new HashEmbeddingAdapter(),
      eventLogRepository,
    )

    const firstRun = await successService.execute({
      sourceId: source.sourceId,
      ingestionJobId: retryJob.ingestionJobId,
    })
    const secondRun = await successService.execute({
      sourceId: source.sourceId,
      ingestionJobId: retryJob.ingestionJobId,
    })

    const chunks = await chunkRepository.listBySourceId(source.sourceId)

    expect(firstRun.status).toBe('completed')
    expect(secondRun.status).toBe('completed')
    expect(chunks).toHaveLength(1)
  })

  it('restores previous chunks if replacement ingestion fails mid-write', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository()
    const source = await sourceRepository.create({
      scenarioId: 'scenario_1',
      name: 'Guide',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/guide.txt',
    })

    const chunkRepository = new FlakyChunkRepository([
      {
        chunkId: 'knowledge_chunk_old',
        sourceId: source.sourceId,
        content: 'stable old chunk',
        chunkIndex: 0,
        createdAt: '2026-05-11T10:00:00.000Z',
      },
    ])
    const jobRepository = new InMemoryIngestionJobRepository()
    const eventLogRepository = new InMemoryEventLogRepository()
    const job = await jobRepository.create({ sourceId: source.sourceId, status: 'queued' })

    const longParagraphA = 'A'.repeat(700)
    const longParagraphB = 'B'.repeat(700)
    const service = new KnowledgeIngestionService(
      sourceRepository,
      chunkRepository,
      jobRepository,
      new StubLoader(`${longParagraphA}\n\n${longParagraphB}`),
      new HashEmbeddingAdapter(),
      eventLogRepository,
    )

    const result = await service.execute({
      sourceId: source.sourceId,
      ingestionJobId: job.ingestionJobId,
    })

    expect(result.status).toBe('failed')
    expect((await jobRepository.findById(job.ingestionJobId))?.status).toBe('failed')
    expect((await sourceRepository.findById(source.sourceId))?.status).toBe('error')

    const chunksAfterFailure = await chunkRepository.listBySourceId(source.sourceId)
    expect(chunksAfterFailure).toHaveLength(1)
    expect(chunksAfterFailure[0]?.content).toBe('stable old chunk')
  })
})
