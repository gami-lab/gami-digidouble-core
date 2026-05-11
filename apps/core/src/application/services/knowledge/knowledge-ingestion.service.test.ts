import { describe, expect, it } from 'vitest'
import { InMemoryIngestionJobRepository } from '../../../infrastructure/db/in-memory-ingestion-job.repository.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { HashEmbeddingAdapter } from '../../../infrastructure/knowledge/hash-embedding.adapter.js'
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

describe('KnowledgeIngestionService', () => {
  it('processes text source into persisted chunks with completed job status', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository()
    const chunkRepository = new InMemoryKnowledgeChunkRepository()
    const jobRepository = new InMemoryIngestionJobRepository()
    const eventLogRepository = new InMemoryEventLogRepository()

    const source = await sourceRepository.create({
      scenarioId: 'scenario_1',
      name: 'Rules',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/rules.txt',
      metadata: { inlineText: 'A\n\nB\n\nC' },
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
  })

  it('marks job as failed and supports deterministic retry idempotency', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository()
    const chunkRepository = new InMemoryKnowledgeChunkRepository()
    const jobRepository = new InMemoryIngestionJobRepository()
    const eventLogRepository = new InMemoryEventLogRepository()

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
})
