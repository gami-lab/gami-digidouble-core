import { DomainError } from '../../../domain/errors.js'
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

    const job = await this.ingestionJobRepository.create({
      sourceId: source.sourceId,
      status: 'queued',
      attempts: 0,
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
      },
      scheduled: true,
    }
  }
}
