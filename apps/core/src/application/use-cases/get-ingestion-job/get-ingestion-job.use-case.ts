import { DomainError } from '../../../domain/errors.js'
import type { IIngestionJobRepository } from '../../ports/IIngestionJobRepository.js'
import type {
  GetIngestionJobInput,
  GetIngestionJobOutput,
  ListIngestionJobsInput,
  ListIngestionJobsOutput,
} from './get-ingestion-job.types.js'

export class GetIngestionJobUseCase {
  constructor(private readonly ingestionJobRepository: IIngestionJobRepository) {}

  async execute(input: GetIngestionJobInput): Promise<GetIngestionJobOutput> {
    const ingestionJobId = input.ingestionJobId.trim()
    if (ingestionJobId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'ingestionJobId must be a non-empty string.')
    }

    const job = await this.ingestionJobRepository.findById(ingestionJobId)
    if (job === null) {
      throw new DomainError('NOT_FOUND', `Ingestion job ${ingestionJobId} not found.`)
    }

    return {
      ingestionJob: {
        ingestionJobId: job.ingestionJobId,
        sourceId: job.sourceId,
        status: job.status,
        attempts: job.attempts,
        createdAt: job.createdAt,
        ...(job.startedAt !== undefined ? { startedAt: job.startedAt } : {}),
        ...(job.completedAt !== undefined ? { completedAt: job.completedAt } : {}),
        ...(job.errorMessage !== undefined ? { errorMessage: job.errorMessage } : {}),
      },
    }
  }

  async listBySource(input: ListIngestionJobsInput): Promise<ListIngestionJobsOutput> {
    const sourceId = input.sourceId.trim()
    if (sourceId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'sourceId must be a non-empty string.')
    }

    const jobs = await this.ingestionJobRepository.listBySourceId(sourceId)
    return {
      jobs: jobs.map((job) => ({
        ingestionJobId: job.ingestionJobId,
        sourceId: job.sourceId,
        status: job.status,
        attempts: job.attempts,
        createdAt: job.createdAt,
        ...(job.startedAt !== undefined ? { startedAt: job.startedAt } : {}),
        ...(job.completedAt !== undefined ? { completedAt: job.completedAt } : {}),
        ...(job.errorMessage !== undefined ? { errorMessage: job.errorMessage } : {}),
      })),
    }
  }
}
