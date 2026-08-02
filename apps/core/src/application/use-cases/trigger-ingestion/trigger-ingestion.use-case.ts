import { DomainError } from '../../../domain/errors.js'
import { INGESTION_CHUNK_SIZE_MAX, INGESTION_CHUNK_SIZE_MIN } from '@gami/shared'
import type { IIngestionJobRepository } from '../../ports/IIngestionJobRepository.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import { KnowledgeIngestionService } from '../../services/knowledge/knowledge-ingestion.service.js'
import type { TriggerIngestionInput, TriggerIngestionOutput } from './trigger-ingestion.types.js'

export class TriggerIngestionUseCase {
  constructor(
    private readonly sourceRepository: IKnowledgeSourceRepository,
    private readonly ingestionJobRepository: IIngestionJobRepository,
    private readonly ingestionService: KnowledgeIngestionService,
  ) {}

  async execute(input: TriggerIngestionInput): Promise<TriggerIngestionOutput> {
    const sourceId = input.sourceId.trim()
    const source = await this.sourceRepository.findById(sourceId)
    if (source === null) {
      throw new DomainError('NOT_FOUND', `Knowledge source ${sourceId} not found.`)
    }
    validateChunkSize(input.chunkSize)

    const job = await this.ingestionJobRepository.create({
      sourceId: source.sourceId,
      status: 'queued',
      attempts: 0,
      ...(input.chunkSize !== undefined ? { chunkSize: input.chunkSize } : {}),
    })

    void this.ingestionService
      .execute({
        sourceId: source.sourceId,
        ingestionJobId: job.ingestionJobId,
        ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      })
      .catch((error: unknown) => {
        console.error('[knowledge-ingestion] Trigger execution failed:', error)
      })

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
        ...(job.chunkSize !== undefined ? { chunkSize: job.chunkSize } : {}),
      },
      scheduled: true,
    }
  }
}

function validateChunkSize(chunkSize: number | undefined): void {
  if (chunkSize === undefined) return
  if (
    !Number.isInteger(chunkSize) ||
    chunkSize < INGESTION_CHUNK_SIZE_MIN ||
    chunkSize > INGESTION_CHUNK_SIZE_MAX
  ) {
    throw new DomainError('VALIDATION_ERROR', 'chunkSize must be an integer between 100 and 10000.')
  }
}
