import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '../../../domain/errors.js'
import { InMemoryIngestionJobRepository } from '../../../infrastructure/db/in-memory-ingestion-job.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryKnowledgeSourceContentLoader } from '../../../infrastructure/knowledge/in-memory-knowledge-source-content-loader.js'
import { HashEmbeddingAdapter } from '../../../infrastructure/knowledge/hash-embedding.adapter.js'
import { KnowledgeIngestionService } from '../../services/knowledge/knowledge-ingestion.service.js'
import { RetryIngestionJobUseCase } from './retry-ingestion-job.use-case.js'

describe('RetryIngestionJobUseCase — retry scheduling', () => {
  it('creates a queued retry job for failed jobs', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const source = await sourceRepo.create({
      scenarioId: 'scenario_1',
      name: 'Retry source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/retry.txt',
    })

    const jobRepo = new InMemoryIngestionJobRepository([
      {
        ingestionJobId: 'ingestion_job_failed',
        sourceId: source.sourceId,
        status: 'failed',
        attempts: 1,
        createdAt: '2026-05-11T10:00:00.000Z',
        updatedAt: '2026-05-11T10:00:00.000Z',
        errorMessage: 'boom',
      },
    ])

    const service = new KnowledgeIngestionService(
      sourceRepo,
      new InMemoryKnowledgeChunkRepository(),
      jobRepo,
      new InMemoryKnowledgeSourceContentLoader(),
      new HashEmbeddingAdapter(),
      new InMemoryEventLogRepository(),
    )
    const executeSpy = vi.spyOn(service, 'execute').mockResolvedValue({
      status: 'completed',
      ingestionJobId: 'ingestion_job_retry',
      sourceId: source.sourceId,
      chunkCount: 1,
    })

    const useCase = new RetryIngestionJobUseCase(jobRepo, service)
    const output = await useCase.execute({ ingestionJobId: 'ingestion_job_failed' })

    expect(output.status).toBe('queued')
    expect(output.previousIngestionJobId).toBe('ingestion_job_failed')
    expect(output.retryIngestionJobId.startsWith('ingestion_job_')).toBe(true)
    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  it('reuses active retry jobs instead of creating duplicates', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const source = await sourceRepo.create({
      scenarioId: 'scenario_1',
      name: 'Retry source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/retry.txt',
    })

    const jobRepo = new InMemoryIngestionJobRepository([
      {
        ingestionJobId: 'ingestion_job_failed',
        sourceId: source.sourceId,
        status: 'failed',
        attempts: 1,
        createdAt: '2026-05-11T10:00:00.000Z',
        updatedAt: '2026-05-11T10:00:00.000Z',
        errorMessage: 'boom',
      },
      {
        ingestionJobId: 'ingestion_job_active',
        sourceId: source.sourceId,
        status: 'running',
        attempts: 1,
        createdAt: '2026-05-11T10:10:00.000Z',
        updatedAt: '2026-05-11T10:10:00.000Z',
      },
    ])

    const service = new KnowledgeIngestionService(
      sourceRepo,
      new InMemoryKnowledgeChunkRepository(),
      jobRepo,
      new InMemoryKnowledgeSourceContentLoader(),
      new HashEmbeddingAdapter(),
      new InMemoryEventLogRepository(),
    )
    const executeSpy = vi.spyOn(service, 'execute')

    const useCase = new RetryIngestionJobUseCase(jobRepo, service)
    const output = await useCase.execute({ ingestionJobId: 'ingestion_job_failed' })

    expect(output).toEqual({
      previousIngestionJobId: 'ingestion_job_failed',
      retryIngestionJobId: 'ingestion_job_active',
      sourceId: source.sourceId,
      status: 'running',
    })
    expect(executeSpy).not.toHaveBeenCalled()
  })
})

describe('RetryIngestionJobUseCase — validation', () => {
  it('rejects retry for non-failed jobs', async () => {
    const jobRepo = new InMemoryIngestionJobRepository([
      {
        ingestionJobId: 'ingestion_job_running',
        sourceId: 'knowledge_source_1',
        status: 'running',
        attempts: 1,
        createdAt: '2026-05-11T10:00:00.000Z',
        updatedAt: '2026-05-11T10:00:00.000Z',
      },
    ])

    const service = new KnowledgeIngestionService(
      new InMemoryKnowledgeSourceRepository(),
      new InMemoryKnowledgeChunkRepository(),
      jobRepo,
      new InMemoryKnowledgeSourceContentLoader(),
      new HashEmbeddingAdapter(),
      new InMemoryEventLogRepository(),
    )

    const useCase = new RetryIngestionJobUseCase(jobRepo, service)

    await expect(useCase.execute({ ingestionJobId: 'ingestion_job_running' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'CONFLICT' }),
    )
  })
})
