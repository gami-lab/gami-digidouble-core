import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '../../../domain/errors.js'
import { InMemoryIngestionJobRepository } from '../../../infrastructure/db/in-memory-ingestion-job.repository.js'
import { RunIngestionJobUseCase } from './run-ingestion-job.use-case.js'

describe('RunIngestionJobUseCase', () => {
  it('runs ingestion job and returns completion payload', async () => {
    const jobRepo = new InMemoryIngestionJobRepository([
      {
        ingestionJobId: 'ingestion_job_1',
        sourceId: 'knowledge_source_1',
        status: 'queued',
        attempts: 0,
        createdAt: '2026-05-11T10:00:00.000Z',
        updatedAt: '2026-05-11T10:00:00.000Z',
      },
    ])

    const ingestionService = {
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        ingestionJobId: 'ingestion_job_1',
        sourceId: 'knowledge_source_1',
        chunkCount: 3,
      }),
    }

    const useCase = new RunIngestionJobUseCase(jobRepo, ingestionService as never)
    const output = await useCase.execute({ ingestionJobId: 'ingestion_job_1' })

    expect(output.status).toBe('completed')
    expect(output.chunkCount).toBe(3)
  })

  it('throws NOT_FOUND for unknown jobs', async () => {
    const useCase = new RunIngestionJobUseCase(new InMemoryIngestionJobRepository(), {
      execute: vi.fn(),
    } as never)

    await expect(useCase.execute({ ingestionJobId: 'ingestion_job_missing' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'NOT_FOUND' }),
    )
  })
})
