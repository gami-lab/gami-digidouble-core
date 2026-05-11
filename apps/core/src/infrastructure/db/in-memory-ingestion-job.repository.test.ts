import { describe, expect, it } from 'vitest'
import type { IngestionJob } from '../../domain/knowledge/knowledge.types.js'
import { InMemoryIngestionJobRepository } from './in-memory-ingestion-job.repository.js'

function makeJob(overrides: Partial<IngestionJob> = {}): IngestionJob {
  return {
    ingestionJobId: 'ingestion_job_1',
    sourceId: 'knowledge_source_1',
    status: 'queued',
    attempts: 0,
    createdAt: '2026-05-11T08:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryIngestionJobRepository', () => {
  it('creates a job with defaults', async () => {
    const repository = new InMemoryIngestionJobRepository()

    const created = await repository.create({ sourceId: 'knowledge_source_1' })

    expect(created.ingestionJobId.startsWith('ingestion_job_')).toBe(true)
    expect(created.status).toBe('queued')
    expect(created.attempts).toBe(0)
  })

  it('updates job status and lifecycle fields', async () => {
    const repository = new InMemoryIngestionJobRepository([makeJob()])

    const updated = await repository.updateStatus('ingestion_job_1', {
      status: 'running',
      attempts: 1,
      startedAt: '2026-05-11T08:01:00.000Z',
    })

    expect(updated?.status).toBe('running')
    expect(updated?.attempts).toBe(1)
    expect(updated?.startedAt).toBe('2026-05-11T08:01:00.000Z')
  })

  it('listBySourceId returns newest jobs first', async () => {
    const repository = new InMemoryIngestionJobRepository([
      makeJob({ ingestionJobId: 'ingestion_job_old', createdAt: '2026-05-11T08:00:00.000Z' }),
      makeJob({ ingestionJobId: 'ingestion_job_new', createdAt: '2026-05-11T09:00:00.000Z' }),
    ])

    const jobs = await repository.listBySourceId('knowledge_source_1')

    expect(jobs.map((job) => job.ingestionJobId)).toEqual([
      'ingestion_job_new',
      'ingestion_job_old',
    ])
  })
})
