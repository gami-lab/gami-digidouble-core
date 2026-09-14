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
import type { KnowledgeChunk } from '../../../domain/knowledge/knowledge.types.js'
import {
  KnowledgeIngestionError,
  toChunkSeeds,
  validateEmbeddingResult,
} from './knowledge-ingestion.service.js'
import { assertStaticMetadataAllowed } from '../../../domain/knowledge/static-knowledge-validation.js'
import { hashKnowledgeChunkContent } from '../../../domain/knowledge/knowledge-content-hash.js'
import { areEmbeddingProfilesEqual } from './embedding-profile.js'

export type KnowledgeReindexStartResult = Readonly<{
  status: 'started' | 'reused'
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
          ...reindexEmbeddingCounts(finalProgress),
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

  // eslint-disable-next-line max-lines-per-function
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
      assertStaticMetadataAllowed(loaded.metadata, 'chunk')
      const seeds = toChunkSeeds(source, loaded.content, loaded.metadata, this.chunkSize)
      if (seeds.length === 0) {
        throw new ReindexSourceError('empty_source', 'Source produced no chunks.')
      }
      const reusableChunks = await this.reusableActiveChunks(operation, profile, source.sourceId)
      const seedsToEmbed = seeds.filter((seed) => {
        return !hasMatchingContent(reusableChunks.get(seed.chunkIndex), seed.contentHash)
      })
      const embeddedChunkCount = seedsToEmbed.length
      const reusedChunkCount = seeds.length - embeddedChunkCount
      const embeddedVectors = new Map<number, readonly number[]>()
      if (seedsToEmbed.length > 0) {
        const result = await this.embeddingAdapter.embed({
          inputs: seedsToEmbed.map((seed) => seed.content),
        })
        validateEmbeddingResult(result, profile, seedsToEmbed.length)
        seedsToEmbed.forEach((seed, index) => {
          const vector = result.vectors[index]
          if (vector === undefined) {
            throw new ReindexSourceError('vector_count_mismatch', 'Embedding vector is missing.')
          }
          embeddedVectors.set(seed.chunkIndex, vector)
        })
      }
      const chunks: StagedKnowledgeChunk[] = seeds.map((seed) => {
        const existing = reusableChunks.get(seed.chunkIndex)
        const isUnchanged = hasMatchingContent(existing, seed.contentHash)
        const embedding = isUnchanged ? existing?.embedding : embeddedVectors.get(seed.chunkIndex)
        if (embedding === undefined) {
          throw new ReindexSourceError(
            'vector_count_mismatch',
            `Embedding vector for chunk ${String(seed.chunkIndex)} is missing.`,
          )
        }
        return {
          sourceId: source.sourceId,
          content: seed.content,
          contentHash: seed.contentHash,
          chunkIndex: seed.chunkIndex,
          embedding: [...embedding],
          embeddingProfileId: operation.embeddingProfileId,
          corpusGenerationId: operation.corpusGenerationId,
          metadata: {
            ...seed.metadata,
            reindexOperationId: operation.reindexOperationId,
          },
          ...(source.visibleToAvatarIds !== undefined
            ? { visibleToAvatarIds: [...source.visibleToAvatarIds] }
            : {}),
        }
      })
      await this.corpusRepository.replaceStagedSourceChunks(
        operation.reindexOperationId,
        source.sourceId,
        chunks,
      )
      await this.corpusRepository.updateReindexSourceProgress(
        operation.reindexOperationId,
        source.sourceId,
        { status: 'completed', embeddedChunkCount, reusedChunkCount },
      )
      await this.appendEventSafe({
        type: 'knowledge_reindex_source_completed',
        severity: 'info',
        payload: {
          ...operationDiagnostics(operation, profile),
          sourceId: source.sourceId,
          vectorCount: chunks.length,
          embeddedChunkCount,
          reusedChunkCount,
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

  private async reusableActiveChunks(
    operation: ReindexOperation,
    profile: EmbeddingProfile,
    sourceId: string,
  ): Promise<Map<number, KnowledgeChunk>> {
    const activeCorpus = await this.corpusRepository.getActiveCorpus()
    if (
      activeCorpus === null ||
      activeCorpus.embeddingProfileId !== operation.embeddingProfileId ||
      activeCorpus.embeddingProfileId !== operation.expectedActiveProfileId ||
      activeCorpus.corpusGenerationId !== operation.expectedActiveGenerationId ||
      !areEmbeddingProfilesEqual(activeCorpus.profile, profile)
    ) {
      return new Map()
    }
    const activeChunks = await this.corpusRepository.listActiveChunksBySourceIds([sourceId])
    return new Map(
      activeChunks
        .filter(
          (chunk) =>
            chunk.embedding !== undefined &&
            chunk.embedding.length === profile.dimensions &&
            chunk.embedding.every((value) => Number.isFinite(value)),
        )
        .map((chunk) => [chunk.chunkIndex, chunk]),
    )
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

function reindexEmbeddingCounts(
  progress: readonly ReindexSourceProgress[],
): Readonly<{ embeddedChunkCount: number; reusedChunkCount: number }> {
  return {
    embeddedChunkCount: progress.reduce((total, entry) => total + entry.embeddedChunkCount, 0),
    reusedChunkCount: progress.reduce((total, entry) => total + entry.reusedChunkCount, 0),
  }
}

function hasMatchingContent(chunk: KnowledgeChunk | undefined, contentHash: string): boolean {
  return (
    chunk !== undefined &&
    (chunk.contentHash ?? hashKnowledgeChunkContent(chunk.content)) === contentHash
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
