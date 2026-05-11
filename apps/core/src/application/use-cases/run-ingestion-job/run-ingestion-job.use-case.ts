import { DomainError } from '../../../domain/errors.js'
import type { IIngestionJobRepository } from '../../ports/IIngestionJobRepository.js'
import { KnowledgeIngestionService } from '../../services/knowledge/knowledge-ingestion.service.js'
import type { RunIngestionJobInput, RunIngestionJobOutput } from './run-ingestion-job.types.js'

export class RunIngestionJobUseCase {
  constructor(
    private readonly ingestionJobRepository: IIngestionJobRepository,
    private readonly ingestionService: KnowledgeIngestionService,
  ) {}

  async execute(input: RunIngestionJobInput): Promise<RunIngestionJobOutput> {
    const job = await this.ingestionJobRepository.findById(input.ingestionJobId)
    if (job === null) {
      throw new DomainError('NOT_FOUND', `Ingestion job ${input.ingestionJobId} not found.`)
    }

    const result = await this.ingestionService.execute({
      sourceId: job.sourceId,
      ingestionJobId: job.ingestionJobId,
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    })

    if (result.status === 'completed') {
      return {
        ingestionJobId: result.ingestionJobId,
        sourceId: result.sourceId,
        status: 'completed',
        chunkCount: result.chunkCount,
      }
    }

    return {
      ingestionJobId: result.ingestionJobId,
      sourceId: result.sourceId,
      status: 'failed',
      errorMessage: result.errorMessage,
    }
  }
}
