import type {
  CreateIngestionJobParams,
  IIngestionJobRepository,
  UpdateIngestionJobStatusParams,
} from '../../application/ports/IIngestionJobRepository.js'
import type { IngestionJob } from '../../domain/knowledge/knowledge.types.js'

export class InMemoryIngestionJobRepository implements IIngestionJobRepository {
  private readonly jobs: Map<string, IngestionJob>

  constructor(initialData: IngestionJob[] = []) {
    this.jobs = new Map(initialData.map((job) => [job.ingestionJobId, job]))
  }

  create(params: CreateIngestionJobParams): Promise<IngestionJob> {
    const now = new Date().toISOString()
    const job: IngestionJob = {
      ingestionJobId: `ingestion_job_${crypto.randomUUID()}`,
      sourceId: params.sourceId,
      status: params.status ?? 'pending',
      attempts: params.attempts ?? 0,
      createdAt: now,
      updatedAt: now,
      ...(params.startedAt !== undefined ? { startedAt: params.startedAt } : {}),
      ...(params.completedAt !== undefined ? { completedAt: params.completedAt } : {}),
      ...(params.errorMessage !== undefined ? { errorMessage: params.errorMessage } : {}),
    }

    this.jobs.set(job.ingestionJobId, job)
    return Promise.resolve(job)
  }

  findById(ingestionJobId: string): Promise<IngestionJob | null> {
    return Promise.resolve(this.jobs.get(ingestionJobId) ?? null)
  }

  listBySourceId(sourceId: string): Promise<IngestionJob[]> {
    const jobs = [...this.jobs.values()]
      .filter((job) => job.sourceId === sourceId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return Promise.resolve(jobs)
  }

  updateStatus(
    ingestionJobId: string,
    updates: UpdateIngestionJobStatusParams,
  ): Promise<IngestionJob | null> {
    const existing = this.jobs.get(ingestionJobId)
    if (existing === undefined) return Promise.resolve(null)

    const updated: IngestionJob = {
      ...existing,
      status: updates.status,
      updatedAt: new Date().toISOString(),
      ...(updates.attempts !== undefined ? { attempts: updates.attempts } : {}),
      ...(updates.startedAt !== undefined ? { startedAt: updates.startedAt } : {}),
      ...(updates.completedAt !== undefined ? { completedAt: updates.completedAt } : {}),
      ...(updates.errorMessage !== undefined ? { errorMessage: updates.errorMessage } : {}),
    }

    this.jobs.set(ingestionJobId, updated)
    return Promise.resolve(updated)
  }
}
