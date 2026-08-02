import type { IngestionJob, IngestionJobStatus } from '../../domain/knowledge/knowledge.types.js'

export type CreateIngestionJobParams = {
  sourceId: string
  status?: IngestionJobStatus
  attempts?: number
  chunkSize?: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

export type UpdateIngestionJobStatusParams = {
  status: IngestionJobStatus
  attempts?: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

export interface IIngestionJobRepository {
  create(params: CreateIngestionJobParams): Promise<IngestionJob>
  findById(ingestionJobId: string): Promise<IngestionJob | null>
  listBySourceId(sourceId: string): Promise<IngestionJob[]>
  updateStatus(
    ingestionJobId: string,
    updates: UpdateIngestionJobStatusParams,
  ): Promise<IngestionJob | null>
}
