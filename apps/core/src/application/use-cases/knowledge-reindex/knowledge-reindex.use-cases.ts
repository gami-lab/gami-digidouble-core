import type {
  GetKnowledgeReindexResponse,
  KnowledgeReindexOperationDto,
  KnowledgeReindexSourceProgressDto,
  RetryKnowledgeReindexResponse,
  StartKnowledgeReindexResponse,
} from '@gami/shared'
import type {
  IKnowledgeCorpusRepository,
  ReindexOperation,
  ReindexSourceProgress,
} from '../../ports/IKnowledgeCorpusRepository.js'
import { KnowledgeReindexService } from '../../services/knowledge/knowledge-reindex.service.js'
import { DomainError } from '../../../domain/errors.js'

export class StartKnowledgeReindexUseCase {
  constructor(
    private readonly reindexService: KnowledgeReindexService,
    private readonly corpusRepository: IKnowledgeCorpusRepository,
  ) {}

  async execute(): Promise<StartKnowledgeReindexResponse> {
    const result = await this.reindexService.start()
    if (result.operation !== null && result.operation.status === 'pending') {
      void this.reindexService.run(result.operation.reindexOperationId).catch((error: unknown) => {
        console.error('[knowledge-reindex] Background execution failed:', error)
      })
    }
    return {
      status: result.status,
      operation:
        result.operation === null
          ? null
          : await presentOperation(result.operation, this.corpusRepository),
    }
  }
}

export class RetryKnowledgeReindexUseCase {
  constructor(
    private readonly reindexService: KnowledgeReindexService,
    private readonly corpusRepository: IKnowledgeCorpusRepository,
  ) {}

  async execute(reindexOperationId: string): Promise<RetryKnowledgeReindexResponse> {
    const operation = await this.corpusRepository.findReindexOperation(reindexOperationId)
    if (operation === null) {
      throw new DomainError('NOT_FOUND', `Reindex operation ${reindexOperationId} not found.`)
    }
    if (operation.status !== 'failed') {
      throw new DomainError('CONFLICT', 'Only failed reindex operations can be retried.')
    }
    void this.reindexService.run(reindexOperationId).catch((error: unknown) => {
      console.error('[knowledge-reindex] Retry execution failed:', error)
    })
    return { operation: await presentOperation(operation, this.corpusRepository) }
  }
}

export class GetKnowledgeReindexUseCase {
  constructor(private readonly corpusRepository: IKnowledgeCorpusRepository) {}

  async execute(reindexOperationId: string): Promise<GetKnowledgeReindexResponse> {
    const operation = await this.corpusRepository.findReindexOperation(reindexOperationId)
    if (operation === null) {
      throw new DomainError('NOT_FOUND', `Reindex operation ${reindexOperationId} not found.`)
    }
    return {
      operation: await presentOperation(operation, this.corpusRepository),
      sources: presentSourceProgress(
        await this.corpusRepository.listReindexSourceProgress(reindexOperationId),
      ),
    }
  }
}

async function presentOperation(
  operation: ReindexOperation,
  corpusRepository: IKnowledgeCorpusRepository,
): Promise<KnowledgeReindexOperationDto> {
  const profile = await corpusRepository.findEmbeddingProfile(operation.embeddingProfileId)
  if (profile === null) {
    throw new DomainError('INTERNAL_ERROR', 'Reindex operation profile is unavailable.')
  }
  return {
    reindexOperationId: operation.reindexOperationId,
    corpusGenerationId: operation.corpusGenerationId,
    embeddingProfileId: operation.embeddingProfileId,
    profile: {
      provider: profile.provider,
      model: profile.model,
      dimensions: profile.dimensions,
    },
    status: operation.status,
    attempts: operation.attempts,
    expectedSourceCount: operation.expectedSourceCount,
    completedSourceCount: operation.completedSourceCount,
    createdAt: operation.createdAt,
    ...(operation.startedAt !== undefined ? { startedAt: operation.startedAt } : {}),
    ...(operation.completedAt !== undefined ? { completedAt: operation.completedAt } : {}),
    ...(operation.failureDetails !== undefined ? { failureDetails: operation.failureDetails } : {}),
  }
}

function presentSourceProgress(
  progress: ReindexSourceProgress[],
): KnowledgeReindexSourceProgressDto[] {
  return progress.map((entry) => ({
    reindexOperationId: entry.reindexOperationId,
    sourceId: entry.sourceId,
    status: entry.status,
    attempts: entry.attempts,
    ...(entry.expectedChunkCount !== undefined
      ? { expectedChunkCount: entry.expectedChunkCount }
      : {}),
    completedChunkCount: entry.completedChunkCount,
    ...(entry.startedAt !== undefined ? { startedAt: entry.startedAt } : {}),
    ...(entry.completedAt !== undefined ? { completedAt: entry.completedAt } : {}),
    ...(entry.failureDetails !== undefined ? { failureDetails: entry.failureDetails } : {}),
  }))
}
