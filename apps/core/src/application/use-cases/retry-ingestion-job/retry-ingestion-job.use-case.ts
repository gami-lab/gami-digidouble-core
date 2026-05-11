import { DomainError } from '../../../domain/errors.js'
import type { IIngestionJobRepository } from '../../ports/IIngestionJobRepository.js'
import { KnowledgeIngestionService } from '../../services/knowledge/knowledge-ingestion.service.js'
import type {
  RetryIngestionJobInput,
  RetryIngestionJobOutput,
} from './retry-ingestion-job.types.js'

export class RetryIngestionJobUseCase {
  constructor(
    private readonly ingestionJobRepository: IIngestionJobRepository,
    private readonly ingestionService: KnowledgeIngestionService,
  ) {}

  async execute(input: RetryIngestionJobInput): Promise<RetryIngestionJobOutput> {
    const job = await this.ingestionJobRepository.findById(input.ingestionJobId)
    if (job === null) {
      throw new DomainError('NOT_FOUND', `Ingestion job ${input.ingestionJobId} not found.`)
    }
    if (job.status !== 'failed') {
      throw new DomainError('CONFLICT', 'Only failed ingestion jobs can be retried.')
    }

    const existingRetry = await this.findActiveRetryForSource(job.sourceId)
    if (existingRetry !== null) {
      return {
        previousIngestionJobId: job.ingestionJobId,
        retryIngestionJobId: existingRetry.ingestionJobId,
        sourceId: existingRetry.sourceId,
        status: existingRetry.status,
      }
    }

    const retry = await this.ingestionJobRepository.create({
      sourceId: job.sourceId,
      status: 'queued',
      attempts: 0,
    })

    void this.ingestionService
      .execute({
        sourceId: retry.sourceId,
        ingestionJobId: retry.ingestionJobId,
        ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      })
      .catch((error: unknown) => {
        console.error('[knowledge-ingestion] Retry execution failed:', error)
      })

    return {
      previousIngestionJobId: job.ingestionJobId,
      retryIngestionJobId: retry.ingestionJobId,
      sourceId: retry.sourceId,
      status: 'queued',
    }
  }

  private async findActiveRetryForSource(
    sourceId: string,
  ): Promise<{ ingestionJobId: string; sourceId: string; status: 'queued' | 'running' } | null> {
    const jobs = await this.ingestionJobRepository.listBySourceId(sourceId)
    const active = jobs.find((entry) => entry.status === 'queued' || entry.status === 'running')
    if (active === undefined) return null
    if (active.status !== 'queued' && active.status !== 'running') return null

    return {
      ingestionJobId: active.ingestionJobId,
      sourceId: active.sourceId,
      status: active.status,
    }
  }
}
