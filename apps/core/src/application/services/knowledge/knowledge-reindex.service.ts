import { INGESTION_CHUNK_SIZE_DEFAULT } from '@gami/shared'
import {
  EmbeddingAdapterError,
  type EmbeddingProfile,
  type IEmbeddingAdapter,
} from '../../ports/IEmbeddingAdapter.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type {
  IKnowledgeCorpusRepository,
  ReindexOperation,
  ReindexSourceProgress,
  StagedKnowledgeChunk,
} from '../../ports/IKnowledgeCorpusRepository.js'
import type { IKnowledgeSourceContentLoader } from '../../ports/IKnowledgeSourceContentLoader.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import {
  KnowledgeIngestionError,
  toChunkSeeds,
  validateEmbeddingResult,
} from './knowledge-ingestion.service.js'

export type KnowledgeReindexStartResult = Readonly<{
  status: 'started' | 'reused' | 'already_active'
  operation: ReindexOperation | null
}>

export class KnowledgeReindexService {
  constructor(
    private readonly sourceRepository: IKnowledgeSourceRepository,
    private readonly corpusRepository: IKnowledgeCorpusRepository,
    private readonly contentLoader: IKnowledgeSourceContentLoader,
    private readonly embeddingAdapter: IEmbeddingAdapter,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly configuredProfile: EmbeddingProfile,
    private readonly chunkSize = INGESTION_CHUNK_SIZE_DEFAULT,
  ) {}

  async start(): Promise<KnowledgeReindexStartResult> {
    const activeCorpus = await this.corpusRepository.getActiveCorpus()
    if (activeCorpus !== null && sameProfile(activeCorpus.profile, this.configuredProfile)) {
      return { status: 'already_active', operation: null }
    }

    const persistedProfile = await this.corpusRepository.createEmbeddingProfile(
      this.configuredProfile,
    )
    const sources = await this.sourceRepository.listAll()
    const operation = await this.corpusRepository.createReindexOperation({
      embeddingProfileId: persistedProfile.embeddingProfileId,
      sourceIds: sources.map((source) => source.sourceId),
    })
    return {
      status: operation.status === 'pending' ? 'started' : 'reused',
      operation,
    }
  }

  async run(reindexOperationId: string): Promise<void> {
    const claimed = await this.corpusRepository.claimReindexOperation(reindexOperationId)
    if (claimed === null) return

    const runStartedAt = Date.now()
    let profile: {
      embeddingProfileId: string
      provider: string
      model: string
      dimensions: number
    } | null = null
    try {
      profile = await this.corpusRepository.findEmbeddingProfile(claimed.embeddingProfileId)
      if (profile === null) {
        await this.failOperation(
          claimed,
          'embedding_profile_missing',
          'Target embedding profile was not found.',
          runStartedAt,
        )
        return
      }
      await this.appendEventSafe({
        type: 'knowledge_reindex_started',
        severity: 'info',
        payload: operationDiagnostics(claimed, profile),
      })
      if (claimed.attempts > 1) {
        await this.appendEventSafe({
          type: 'knowledge_reindex_retry',
          severity: 'info',
          payload: { ...operationDiagnostics(claimed, profile), outcome: 'retry' },
        })
      }

      const progress = await this.corpusRepository.listReindexSourceProgress(
        claimed.reindexOperationId,
      )
      for (const sourceProgress of progress) {
        if (sourceProgress.status === 'completed') continue
        await this.processSource(claimed, profile, sourceProgress)
      }

      const finalProgress = await this.corpusRepository.listReindexSourceProgress(
        claimed.reindexOperationId,
      )
      const failedSource = finalProgress.find((entry) => entry.status === 'failed')
      if (failedSource !== undefined) {
        await this.failOperation(
          claimed,
          'source_failed',
          `Source ${failedSource.sourceId} failed during reindexing.`,
          runStartedAt,
          profile,
        )
        return
      }

      const validation = await this.corpusRepository.validateCorpusGeneration(
        claimed.reindexOperationId,
      )
      if (!validation.valid) {
        await this.failOperation(
          claimed,
          'corpus_incomplete',
          validation.failureDetails ?? 'Replacement corpus validation failed.',
          runStartedAt,
          profile,
        )
        return
      }

      const active = await this.corpusRepository.promoteCorpusGeneration(claimed.reindexOperationId)
      await this.corpusRepository.updateReindexOperation(claimed.reindexOperationId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      await this.appendEventSafe({
        type: 'knowledge_reindex_completed',
        severity: 'info',
        payload: {
          ...operationDiagnostics(claimed, profile),
          activeGenerationId: active.corpusGenerationId,
          activeProfileId: active.embeddingProfileId,
          outcome: 'promoted',
          durationMs: Date.now() - runStartedAt,
        },
      })
    } catch (error) {
      await this.failOperation(
        claimed,
        failureCode(error),
        safeFailureMessage(error),
        runStartedAt,
        profile,
      )
    }
  }

  private async processSource(
    operation: ReindexOperation,
    profile: { embeddingProfileId: string; provider: string; model: string; dimensions: number },
    sourceProgress: ReindexSourceProgress,
  ): Promise<void> {
    const attempts = sourceProgress.attempts + 1
    await this.corpusRepository.updateReindexSourceProgress(
      operation.reindexOperationId,
      sourceProgress.sourceId,
      {
        status: 'running',
        attempts,
        startedAt: new Date().toISOString(),
        failureDetails: '',
      },
    )

    try {
      const source = await this.sourceRepository.findById(sourceProgress.sourceId)
      if (source === null) throw new ReindexSourceError('source_missing', 'Source was not found.')
      const loaded = await this.contentLoader.load(source)
      const seeds = toChunkSeeds(source, loaded.content, loaded.metadata, this.chunkSize)
      if (seeds.length === 0) {
        throw new ReindexSourceError('empty_source', 'Source produced no chunks.')
      }
      const result = await this.embeddingAdapter.embed({
        inputs: seeds.map((seed) => seed.content),
      })
      validateEmbeddingResult(result, profile, seeds.length)
      const chunks: StagedKnowledgeChunk[] = seeds.map((seed, index) => ({
        sourceId: source.sourceId,
        content: seed.content,
        chunkIndex: seed.chunkIndex,
        embedding: [...(result.vectors[index] ?? [])],
        embeddingProfileId: operation.embeddingProfileId,
        corpusGenerationId: operation.corpusGenerationId,
        metadata: {
          ...seed.metadata,
          reindexOperationId: operation.reindexOperationId,
        },
        ...(source.visibleToAvatarIds !== undefined
          ? { visibleToAvatarIds: [...source.visibleToAvatarIds] }
          : {}),
      }))
      await this.corpusRepository.replaceStagedSourceChunks(
        operation.reindexOperationId,
        source.sourceId,
        chunks,
      )
      await this.appendEventSafe({
        type: 'knowledge_reindex_source_completed',
        severity: 'info',
        payload: {
          ...operationDiagnostics(operation, profile),
          sourceId: source.sourceId,
          vectorCount: chunks.length,
          sourceAttempts: attempts,
        },
      })
    } catch (error) {
      const code = failureCode(error)
      const message = safeFailureMessage(error)
      await this.corpusRepository.updateReindexSourceProgress(
        operation.reindexOperationId,
        sourceProgress.sourceId,
        {
          status: 'failed',
          attempts,
          completedAt: new Date().toISOString(),
          failureDetails: `${code}: ${message}`,
        },
      )
      await this.appendEventSafe({
        type: 'knowledge_reindex_source_failed',
        severity: 'error',
        payload: {
          ...operationDiagnostics(operation, profile),
          sourceId: sourceProgress.sourceId,
          failureCode: code,
          sourceAttempts: attempts,
        },
      })
    }
  }

  private async failOperation(
    operation: ReindexOperation,
    code: string,
    message: string,
    runStartedAt?: number,
    profile?: {
      provider: string
      model: string
      dimensions: number
    } | null,
  ): Promise<void> {
    await this.corpusRepository.updateReindexOperation(operation.reindexOperationId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      failureDetails: `${code}: ${message}`,
    })
    await this.appendEventSafe({
      type: 'knowledge_reindex_failed',
      severity: 'error',
      payload: {
        ...operationDiagnostics(operation, profile),
        failureCode: code,
        outcome: 'blocked',
        ...(runStartedAt !== undefined ? { durationMs: Date.now() - runStartedAt } : {}),
      },
    })
  }

  private async appendEventSafe(args: Parameters<IEventLogRepository['append']>[0]): Promise<void> {
    try {
      await this.eventLogRepository.append(args)
    } catch (error) {
      console.error('[knowledge-reindex] Event log append failed:', error)
    }
  }
}

class ReindexSourceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ReindexSourceError'
  }
}

function sameProfile(left: EmbeddingProfile, right: EmbeddingProfile): boolean {
  return (
    left.provider === right.provider &&
    left.model === right.model &&
    left.dimensions === right.dimensions
  )
}

function operationDiagnostics(
  operation: ReindexOperation,
  profile?: {
    provider: string
    model: string
    dimensions: number
  } | null,
): Record<string, unknown> {
  return {
    reindexOperationId: operation.reindexOperationId,
    corpusGenerationId: operation.corpusGenerationId,
    embeddingProfileId: operation.embeddingProfileId,
    expectedSourceCount: operation.expectedSourceCount,
    completedSourceCount: operation.completedSourceCount,
    attempts: operation.attempts,
    ...(profile === null || profile === undefined
      ? {}
      : {
          provider: profile.provider,
          model: profile.model,
          dimensions: profile.dimensions,
        }),
  }
}

function failureCode(error: unknown): string {
  if (error instanceof ReindexSourceError) return error.code
  if (error instanceof EmbeddingAdapterError) return error.failure.code
  if (error instanceof KnowledgeIngestionError) return error.code
  if (error instanceof Error && error.message.includes('Active corpus changed')) {
    return 'stale_active_corpus'
  }
  return 'reindex_failed'
}

function safeFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Reindex operation failed.'
  return error.message.slice(0, 500)
}
