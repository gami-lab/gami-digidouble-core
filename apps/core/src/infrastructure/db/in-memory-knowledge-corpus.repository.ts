import type { EmbeddingProfile } from '../../application/ports/IEmbeddingAdapter.js'
import { MAX_REINDEX_FAILURE_DETAILS_LENGTH } from '../../application/ports/IKnowledgeCorpusRepository.js'
import type {
  ActiveCorpus,
  CorpusGeneration,
  CorpusValidation,
  CreateReindexOperationParams,
  IKnowledgeCorpusRepository,
  PersistedEmbeddingProfile,
  ReindexOperation,
  ReindexSourceProgress,
  StagedKnowledgeChunk,
  UpdateReindexOperationParams,
  UpdateReindexSourceProgressParams,
} from '../../application/ports/IKnowledgeCorpusRepository.js'
import type { KnowledgeChunk } from '../../domain/knowledge/knowledge.types.js'
import { InMemoryKnowledgeChunkRepository } from './in-memory-knowledge-chunk.repository.js'

type MutableOperation = {
  reindexOperationId: string
  corpusGenerationId: string
  embeddingProfileId: string
  status: ReindexOperation['status']
  attempts: number
  expectedSourceCount: number
  completedSourceCount: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  failureDetails?: string
  sourceIds: string[]
}

export class InMemoryKnowledgeCorpusRepository implements IKnowledgeCorpusRepository {
  private readonly profiles = new Map<string, PersistedEmbeddingProfile>()
  private readonly generations = new Map<string, CorpusGeneration>()
  private readonly operations = new Map<string, MutableOperation>()
  private readonly progress = new Map<string, ReindexSourceProgress>()
  private activeCorpus: ActiveCorpus | null = null

  constructor(private readonly chunkRepository: InMemoryKnowledgeChunkRepository) {}

  createEmbeddingProfile(profile: EmbeddingProfile): Promise<PersistedEmbeddingProfile> {
    if (!Number.isInteger(profile.dimensions) || profile.dimensions <= 0) {
      return Promise.reject(new Error('Embedding profile dimensions must be positive.'))
    }
    const existing = [...this.profiles.values()].find(
      (candidate) =>
        candidate.provider === profile.provider &&
        candidate.model === profile.model &&
        candidate.dimensions === profile.dimensions,
    )
    if (existing !== undefined) return Promise.resolve(existing)

    const persisted: PersistedEmbeddingProfile = {
      embeddingProfileId: `embedding_profile_${crypto.randomUUID()}`,
      ...profile,
      createdAt: new Date().toISOString(),
    }
    this.profiles.set(persisted.embeddingProfileId, persisted)
    return Promise.resolve(persisted)
  }

  createReindexOperation(params: CreateReindexOperationParams): Promise<ReindexOperation> {
    const profile = this.profiles.get(params.embeddingProfileId)
    if (profile === undefined) throw new Error('Embedding profile not found.')
    const sourceIds = [...new Set(params.sourceIds)]
    const operationId = params.reindexOperationId ?? `reindex_operation_${crypto.randomUUID()}`
    const existing = this.operations.get(operationId)
    if (existing !== undefined) return Promise.resolve(publicOperation(existing))
    const generationId = params.corpusGenerationId ?? `corpus_generation_${crypto.randomUUID()}`
    const now = new Date().toISOString()
    this.generations.set(generationId, {
      corpusGenerationId: generationId,
      embeddingProfileId: profile.embeddingProfileId,
      status: 'staging',
      expectedSourceCount: sourceIds.length,
      createdAt: now,
    })
    const operation: MutableOperation = {
      reindexOperationId: operationId,
      corpusGenerationId: generationId,
      embeddingProfileId: profile.embeddingProfileId,
      status: 'pending',
      attempts: 0,
      expectedSourceCount: sourceIds.length,
      completedSourceCount: 0,
      createdAt: now,
      sourceIds,
    }
    this.operations.set(operationId, operation)
    for (const sourceId of sourceIds) {
      this.progress.set(progressKey(operationId, sourceId), {
        reindexOperationId: operationId,
        sourceId,
        status: 'pending',
        attempts: 0,
        completedChunkCount: 0,
      })
    }
    return Promise.resolve(publicOperation(operation))
  }

  findReindexOperation(reindexOperationId: string): Promise<ReindexOperation | null> {
    const operation = this.operations.get(reindexOperationId)
    return Promise.resolve(operation === undefined ? null : publicOperation(operation))
  }

  updateReindexOperation(
    reindexOperationId: string,
    updates: UpdateReindexOperationParams,
  ): Promise<ReindexOperation | null> {
    const operation = this.operations.get(reindexOperationId)
    if (operation === undefined) return Promise.resolve(null)
    Object.assign(operation, {
      ...updates,
      ...(updates.failureDetails !== undefined
        ? { failureDetails: boundFailureDetails(updates.failureDetails) }
        : {}),
    })
    return Promise.resolve(publicOperation(operation))
  }

  listReindexSourceProgress(reindexOperationId: string): Promise<ReindexSourceProgress[]> {
    const operation = this.operations.get(reindexOperationId)
    if (operation === undefined) return Promise.resolve([])
    return Promise.resolve(
      operation.sourceIds
        .map((sourceId) => this.progress.get(progressKey(reindexOperationId, sourceId)))
        .filter((entry): entry is ReindexSourceProgress => entry !== undefined),
    )
  }

  updateReindexSourceProgress(
    reindexOperationId: string,
    sourceId: string,
    updates: UpdateReindexSourceProgressParams,
  ): Promise<ReindexSourceProgress | null> {
    const key = progressKey(reindexOperationId, sourceId)
    const current = this.progress.get(key)
    if (current === undefined) return Promise.resolve(null)
    const updated = {
      ...current,
      ...updates,
      ...(updates.failureDetails !== undefined
        ? { failureDetails: boundFailureDetails(updates.failureDetails) }
        : {}),
    }
    this.progress.set(key, updated)
    const operation = this.operations.get(reindexOperationId)
    if (operation !== undefined) {
      operation.completedSourceCount = [...this.progress.values()].filter(
        (entry) => entry.reindexOperationId === reindexOperationId && entry.status === 'completed',
      ).length
    }
    return Promise.resolve(updated)
  }

  async replaceStagedSourceChunks(
    reindexOperationId: string,
    sourceId: string,
    chunks: readonly StagedKnowledgeChunk[],
  ): Promise<number> {
    const operation = this.operations.get(reindexOperationId)
    if (operation === undefined) throw new Error('Reindex operation not found.')
    const profile = this.profiles.get(operation.embeddingProfileId)
    if (profile === undefined) throw new Error('Embedding profile not found.')
    if (!operation.sourceIds.includes(sourceId)) throw new Error('Source is not part of operation.')
    for (const chunk of chunks) {
      if (
        chunk.sourceId !== sourceId ||
        chunk.corpusGenerationId !== operation.corpusGenerationId ||
        chunk.embeddingProfileId !== operation.embeddingProfileId
      ) {
        throw new Error('Staged chunk identity does not match the reindex operation.')
      }
      if (chunk.embedding.length !== profile.dimensions) {
        throw new Error('Staged chunk vector dimension does not match the embedding profile.')
      }
    }
    this.chunkRepository.deleteBySourceIdAndGeneration(sourceId, operation.corpusGenerationId)
    for (const chunk of chunks) await this.chunkRepository.create(chunk)
    await this.updateReindexSourceProgress(reindexOperationId, sourceId, {
      status: 'completed',
      expectedChunkCount: chunks.length,
      completedChunkCount: chunks.length,
      completedAt: new Date().toISOString(),
    })
    return chunks.length
  }

  async validateCorpusGeneration(reindexOperationId: string): Promise<CorpusValidation> {
    const operation = this.operations.get(reindexOperationId)
    if (operation === undefined) throw new Error('Reindex operation not found.')
    const progress = await this.listReindexSourceProgress(reindexOperationId)
    const chunks = this.chunkRepository
      .listAllBySourceIds(operation.sourceIds)
      .filter(
        (chunk) =>
          chunk.corpusGenerationId === operation.corpusGenerationId &&
          chunk.embeddingProfileId === operation.embeddingProfileId,
      )
    const completedSourceCount = progress.filter((entry) => entry.status === 'completed').length
    const valid =
      completedSourceCount === operation.expectedSourceCount &&
      progress.every(
        (entry) => entry.status === 'completed' && (entry.expectedChunkCount ?? 0) > 0,
      ) &&
      chunks.length > 0 &&
      chunks.every(
        (chunk) =>
          chunk.embedding !== undefined &&
          chunk.embedding.length === profileDimensions(this.profiles, operation.embeddingProfileId),
      )
    const validation: CorpusValidation = {
      valid,
      corpusGenerationId: operation.corpusGenerationId,
      embeddingProfileId: operation.embeddingProfileId,
      expectedSourceCount: operation.expectedSourceCount,
      completedSourceCount,
      expectedChunkCount: progress.reduce((sum, entry) => sum + (entry.expectedChunkCount ?? 0), 0),
      actualChunkCount: chunks.length,
      nonNullVectorCount: chunks.filter((chunk) => chunk.embedding !== undefined).length,
      ...(valid ? {} : { failureDetails: 'Generation is incomplete or contains null vectors.' }),
    }
    if (valid) {
      const generation = this.generations.get(operation.corpusGenerationId)
      if (generation !== undefined)
        this.generations.set(operation.corpusGenerationId, {
          ...generation,
          status: 'validated',
          validatedAt: new Date().toISOString(),
        })
    }
    return validation
  }

  async promoteCorpusGeneration(reindexOperationId: string): Promise<ActiveCorpus> {
    const operation = this.operations.get(reindexOperationId)
    if (operation === undefined) throw new Error('Reindex operation not found.')
    const validation = await this.validateCorpusGeneration(reindexOperationId)
    if (!validation.valid) throw new Error(validation.failureDetails ?? 'Corpus validation failed.')
    const profile = this.profiles.get(operation.embeddingProfileId)
    if (profile === undefined) throw new Error('Embedding profile not found.')
    const generation = this.generations.get(operation.corpusGenerationId)
    if (generation === undefined) throw new Error('Corpus generation not found.')
    if (this.activeCorpus !== null) {
      const previous = this.generations.get(this.activeCorpus.corpusGenerationId)
      if (previous !== undefined) {
        this.generations.set(this.activeCorpus.corpusGenerationId, {
          ...previous,
          status: 'superseded',
        })
      }
    }
    this.generations.set(operation.corpusGenerationId, {
      ...generation,
      status: 'active',
      activatedAt: new Date().toISOString(),
    })
    operation.status = 'completed'
    operation.completedAt = new Date().toISOString()
    const active: ActiveCorpus = {
      corpusGenerationId: operation.corpusGenerationId,
      embeddingProfileId: profile.embeddingProfileId,
      profile,
    }
    this.activeCorpus = active
    this.chunkRepository.setActiveCorpus(active)
    return active
  }

  getActiveCorpus(): Promise<ActiveCorpus | null> {
    return Promise.resolve(this.activeCorpus)
  }

  listActiveChunksBySourceIds(sourceIds: readonly string[]): Promise<KnowledgeChunk[]> {
    const chunks = this.chunkRepository
      .listAllBySourceIds(sourceIds)
      .filter((chunk) =>
        this.activeCorpus === null
          ? chunk.corpusGenerationId === undefined
          : chunk.corpusGenerationId === this.activeCorpus.corpusGenerationId &&
            chunk.embeddingProfileId === this.activeCorpus.embeddingProfileId,
      )
      .sort((left, right) => {
        if (left.sourceId !== right.sourceId) return left.sourceId.localeCompare(right.sourceId)
        return left.chunkIndex - right.chunkIndex
      })
    return Promise.resolve(chunks)
  }
}

function progressKey(operationId: string, sourceId: string): string {
  return `${operationId}:${sourceId}`
}

function publicOperation(operation: MutableOperation): ReindexOperation {
  return {
    reindexOperationId: operation.reindexOperationId,
    corpusGenerationId: operation.corpusGenerationId,
    embeddingProfileId: operation.embeddingProfileId,
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

function profileDimensions(
  profiles: Map<string, PersistedEmbeddingProfile>,
  profileId: string,
): number {
  return profiles.get(profileId)?.dimensions ?? -1
}

function boundFailureDetails(value: string): string {
  return value.slice(0, MAX_REINDEX_FAILURE_DETAILS_LENGTH)
}
