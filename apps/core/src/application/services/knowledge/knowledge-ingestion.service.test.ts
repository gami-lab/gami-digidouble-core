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

  it('excludes inlineText from chunk metadata while keeping other loader metadata', async () => {
    const { sourceRepository, chunkRepository, jobRepository, eventLogRepository } =
      createDefaultIngestionDeps()

    const source = await sourceRepository.create({
      scenarioId: 'scenario_1',
      name: 'Kingdom lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: 'inline://kingdom-lore.txt',
    })
    const job = await jobRepository.create({ sourceId: source.sourceId, status: 'queued' })

    class InlineTextLoader implements IKnowledgeSourceContentLoader {
      load(): Promise<{ content: string; metadata?: Record<string, unknown> }> {
        return Promise.resolve({
          content: 'Full document body.',
          metadata: { inlineText: 'Full document body.', tags: ['kingdom'] },
        })
      }
    }

    const service = new KnowledgeIngestionService(
      sourceRepository,
      chunkRepository,
      jobRepository,
      new InlineTextLoader(),
      new HashEmbeddingAdapter(),
      eventLogRepository,
    )

    await service.execute({ sourceId: source.sourceId, ingestionJobId: job.ingestionJobId })

    const chunks = await chunkRepository.listBySourceId(source.sourceId)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.metadata?.inlineText).toBeUndefined()
    expect(chunks[0]?.metadata?.tags).toEqual(['kingdom'])
  })
})

describe('KnowledgeIngestionService — paragraph chunking', () => {
  it('packs complete paragraphs up to the target size without splitting a paragraph', async () => {
    const { sourceRepository, chunkRepository, jobRepository, eventLogRepository } =
      createDefaultIngestionDeps()
    const source = await sourceRepository.create({
      scenarioId: 'scenario_1',
      name: 'Paragraph guide',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/paragraph-guide.txt',
    })
    const job = await jobRepository.create({ sourceId: source.sourceId, status: 'queued' })
    const firstParagraph = 'A'.repeat(390)
    const secondParagraph = 'B'.repeat(390)
    const thirdParagraph = 'C'.repeat(100)

    const service = new KnowledgeIngestionService(
      sourceRepository,
      chunkRepository,
      jobRepository,
      new StubLoader(`${firstParagraph}\n\n${secondParagraph}\n\n${thirdParagraph}`),
      new HashEmbeddingAdapter(),
      eventLogRepository,
    )

    await service.execute({ sourceId: source.sourceId, ingestionJobId: job.ingestionJobId })

    const chunks = await chunkRepository.listBySourceId(source.sourceId)
    expect(chunks.map((chunk) => chunk.content)).toEqual([
      `${firstParagraph}\n\n${secondParagraph}`,
      thirdParagraph,
    ])
  })

  it('keeps an oversized paragraph intact instead of cutting it at the target size', async () => {
    const { sourceRepository, chunkRepository, jobRepository, eventLogRepository } =
      createDefaultIngestionDeps()
    const source = await sourceRepository.create({
      scenarioId: 'scenario_1',
      name: 'Long paragraph',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/long-paragraph.txt',
    })
    const job = await jobRepository.create({ sourceId: source.sourceId, status: 'queued' })
    const oversizedParagraph = 'A'.repeat(900)
    const nextParagraph = 'B'.repeat(100)

    const service = new KnowledgeIngestionService(
      sourceRepository,
      chunkRepository,
      jobRepository,
      new StubLoader(`${oversizedParagraph}\n\n${nextParagraph}`),
      new HashEmbeddingAdapter(),
      eventLogRepository,
    )

    await service.execute({ sourceId: source.sourceId, ingestionJobId: job.ingestionJobId })

    const chunks = await chunkRepository.listBySourceId(source.sourceId)
    expect(chunks.map((chunk) => chunk.content)).toEqual([oversizedParagraph, nextParagraph])
  })
})

describe('KnowledgeIngestionService — header-aware chunking', () => {
  it('stores the active markdown header path with every chunk that needs it', async () => {
    const { sourceRepository, chunkRepository, jobRepository, eventLogRepository } =
      createDefaultIngestionDeps()
    const source = await sourceRepository.create({
      scenarioId: 'scenario_1',
      name: 'Markdown guide',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/tmp/guide.md',
    })
    const job = await jobRepository.create({ sourceId: source.sourceId, status: 'queued' })
    const firstParagraph = `Introduction ${'A'.repeat(450)}`
    const secondParagraph = `Harbor ${'B'.repeat(450)}`
    const thirdParagraph = `Details ${'C'.repeat(450)}`

    const service = new KnowledgeIngestionService(
      sourceRepository,
      chunkRepository,
      jobRepository,
      new StubLoader(
        `# Guide\n\n${firstParagraph}\n\n## Harbor\n\n${secondParagraph}\n\n####details\n\n${thirdParagraph}`,
      ),
      new HashEmbeddingAdapter(),
      eventLogRepository,
    )

    await service.execute({ sourceId: source.sourceId, ingestionJobId: job.ingestionJobId })

    const chunks = await chunkRepository.listBySourceId(source.sourceId)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]?.content).toContain('# Guide')
    expect(chunks[0]?.content).toContain('## Harbor')
    expect(chunks[1]?.content).toMatch(/^# Guide\n\n## Harbor\n\n####details\n\nDetails /)
  })

  it('repeats a section header when a section spans multiple chunks', async () => {
    const { sourceRepository, chunkRepository, jobRepository, eventLogRepository } =
      createDefaultIngestionDeps()
    const source = await sourceRepository.create({
      scenarioId: 'scenario_1',
      name: 'Section guide',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/tmp/section-guide.md',
    })
    const job = await jobRepository.create({ sourceId: source.sourceId, status: 'queued' })
    const firstParagraph = 'A'.repeat(850)
    const secondParagraph = 'B'.repeat(850)

    const service = new KnowledgeIngestionService(
      sourceRepository,
      chunkRepository,
      jobRepository,
      new StubLoader(`## Section\n\n${firstParagraph}\n\n${secondParagraph}`),
      new HashEmbeddingAdapter(),
      eventLogRepository,
    )

    await service.execute({ sourceId: source.sourceId, ingestionJobId: job.ingestionJobId })

    const chunks = await chunkRepository.listBySourceId(source.sourceId)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]?.content.startsWith('## Section\n\n')).toBe(true)
    expect(chunks[1]?.content.startsWith('## Section\n\n')).toBe(true)
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
