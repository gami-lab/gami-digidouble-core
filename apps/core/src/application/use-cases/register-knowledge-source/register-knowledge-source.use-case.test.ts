import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '../../../domain/errors.js'
import { InMemoryIngestionJobRepository } from '../../../infrastructure/db/in-memory-ingestion-job.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryKnowledgeSourceContentLoader } from '../../../infrastructure/knowledge/in-memory-knowledge-source-content-loader.js'
import { HashEmbeddingAdapter } from '../../../infrastructure/knowledge/hash-embedding.adapter.js'
import { KnowledgeIngestionService } from '../../services/knowledge/knowledge-ingestion.service.js'
import { RegisterKnowledgeSourceUseCase } from './register-knowledge-source.use-case.js'

describe('RegisterKnowledgeSourceUseCase', () => {
  it('registers source and enqueues ingestion job', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const jobRepo = new InMemoryIngestionJobRepository()
    const service = new KnowledgeIngestionService(
      sourceRepo,
      new InMemoryKnowledgeChunkRepository(),
      jobRepo,
      new InMemoryKnowledgeSourceContentLoader(),
      new HashEmbeddingAdapter(),
      new InMemoryEventLogRepository(),
    )

    const useCase = new RegisterKnowledgeSourceUseCase(sourceRepo, jobRepo, service)
    const executeSpy = vi.spyOn(service, 'execute').mockResolvedValue({
      status: 'completed',
      ingestionJobId: 'ingestion_job_1',
      sourceId: 'knowledge_source_1',
      chunkCount: 1,
    })

    const output = await useCase.execute({
      scenarioId: 'scenario_1',
      name: '  Source name  ',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '  /tmp/source.txt  ',
      triggerIngestion: true,
    })

    expect(output.source.name).toBe('Source name')
    expect(output.ingestionJob.status).toBe('queued')
    expect(output.ingestionScheduled).toBe(true)
    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  it('throws validation error for blank fields', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const jobRepo = new InMemoryIngestionJobRepository()
    const service = new KnowledgeIngestionService(
      sourceRepo,
      new InMemoryKnowledgeChunkRepository(),
      jobRepo,
      new InMemoryKnowledgeSourceContentLoader(),
      new HashEmbeddingAdapter(),
      new InMemoryEventLogRepository(),
    )
    const useCase = new RegisterKnowledgeSourceUseCase(sourceRepo, jobRepo, service)

    await expect(
      useCase.execute({
        scenarioId: 'scenario_1',
        name: '   ',
        knowledgeType: 'world',
        format: 'text',
        uriOrPath: '/tmp/source.txt',
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }))
  })
})
