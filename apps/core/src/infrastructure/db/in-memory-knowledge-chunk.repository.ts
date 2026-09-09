import type {
  CreateKnowledgeChunkParams,
  IKnowledgeChunkRepository,
  VectorSearchRequest,
  VectorSearchResult,
} from '../../application/ports/IKnowledgeChunkRepository.js'
import {
  KnowledgeVectorSearchError,
  MAX_VECTOR_SEARCH_CANDIDATES,
} from '../../application/ports/IKnowledgeChunkRepository.js'
import type { KnowledgeChunk, KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'
import {
  buildKnowledgeVisibilitySelection,
  isKnowledgeVisibleToAvatar,
} from '../../domain/knowledge/knowledge-visibility.js'
import type { IKnowledgeSourceRepository } from '../../application/ports/IKnowledgeSourceRepository.js'
import type { ActiveCorpus } from '../../application/ports/IKnowledgeCorpusRepository.js'
import type { StagedKnowledgeChunk } from '../../application/ports/IKnowledgeCorpusRepository.js'

function normalizeVisibleToAvatarIds(
  visibleToAvatarIds: string[] | undefined,
): string[] | undefined {
  if (visibleToAvatarIds === undefined) return undefined
  const normalized = visibleToAvatarIds
    .map((avatarId) => avatarId.trim())
    .filter((avatarId) => avatarId.length > 0)
  return normalized.length > 0 ? normalized : undefined
}

export class InMemoryKnowledgeChunkRepository implements IKnowledgeChunkRepository {
  private readonly chunks: Map<string, KnowledgeChunk>
  private activeCorpus: ActiveCorpus | null = null

  constructor(
    initialData: KnowledgeChunk[] = [],
    private readonly sourceRepository?: Pick<
      IKnowledgeSourceRepository,
      'findById' | 'listByScenario'
    >,
  ) {
    this.chunks = new Map(initialData.map((chunk) => [chunk.chunkId, chunk]))
  }

  create(params: CreateKnowledgeChunkParams): Promise<KnowledgeChunk> {
    const visibleToAvatarIds = normalizeVisibleToAvatarIds(params.visibleToAvatarIds)
    const chunk: KnowledgeChunk = {
      chunkId: `knowledge_chunk_${crypto.randomUUID()}`,
      sourceId: params.sourceId,
      content: params.content,
      chunkIndex: params.chunkIndex,
      ...(params.embedding !== undefined ? { embedding: [...params.embedding] } : {}),
      ...(params.embeddingProfileId !== undefined
        ? { embeddingProfileId: params.embeddingProfileId }
        : {}),
      ...(params.corpusGenerationId !== undefined
        ? { corpusGenerationId: params.corpusGenerationId }
        : {}),
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
      ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
      createdAt: new Date().toISOString(),
    }

    this.chunks.set(chunk.chunkId, chunk)
    return Promise.resolve(chunk)
  }

  listBySourceId(sourceId: string): Promise<KnowledgeChunk[]> {
    const chunks = [...this.chunks.values()]
      .filter((chunk) => chunk.sourceId === sourceId)
      .filter((chunk) => this.isVisibleInActiveCorpus(chunk))
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
    return Promise.resolve(chunks)
  }

  listBySourceIds(sourceIds: string[]): Promise<KnowledgeChunk[]> {
    const sourceSet = new Set(sourceIds)
    const chunks = [...this.chunks.values()]
      .filter((chunk) => sourceSet.has(chunk.sourceId))
      .filter((chunk) => this.isVisibleInActiveCorpus(chunk))
      .sort((a, b) => {
        if (a.sourceId === b.sourceId) return a.chunkIndex - b.chunkIndex
        return a.sourceId.localeCompare(b.sourceId)
      })
    return Promise.resolve(chunks)
  }

  async searchByVector(request: VectorSearchRequest): Promise<VectorSearchResult> {
    validateVectorSearchRequest(request)
    assertMatchingActiveCorpus(this.activeCorpus, request)
    if (hasEmptySourceScope(request)) return []
    const sourceRepository = this.sourceRepository
    if (sourceRepository === undefined) return []

    const eligibleSources = filterEligibleSources(
      await findVectorSources(sourceRepository, request),
      request,
    )
    const sourceById = new Map(eligibleSources.map((source) => [source.sourceId, source]))
    const eligibleSourceIds =
      request.eligibleSourceIds ?? eligibleSources.map((source) => source.sourceId)
    const queryNorm = vectorNorm(request.queryVector)

    return [...this.chunks.values()]
      .filter((chunk) => isEligibleVectorChunk(chunk, request, eligibleSourceIds, sourceById))
      .filter((chunk) => memoryMetadataMatches(chunk, request))
      .filter((chunk) => isVisibleVectorChunk(chunk, request, sourceById))
      .map((chunk) => {
        const distance = cosineDistance(
          request.queryVector,
          queryNorm,
          chunk.embedding as readonly number[],
        )
        return { chunk, distance }
      })
      .filter(({ distance }) => Number.isFinite(distance))
      .sort(compareVectorChunks)
      .slice(0, request.candidateLimit)
      .map(({ chunk, distance }) => toVectorCandidate(chunk, distance, request))
  }

  deleteBySourceId(sourceId: string): Promise<number> {
    const toDelete = [...this.chunks.values()].filter((chunk) => chunk.sourceId === sourceId)
    for (const chunk of toDelete) {
      this.chunks.delete(chunk.chunkId)
    }
    return Promise.resolve(toDelete.length)
  }

  deleteBySourceIdAndGeneration(sourceId: string, corpusGenerationId: string): number {
    const toDelete = [...this.chunks.values()].filter(
      (chunk) => chunk.sourceId === sourceId && chunk.corpusGenerationId === corpusGenerationId,
    )
    for (const chunk of toDelete) this.chunks.delete(chunk.chunkId)
    return toDelete.length
  }

  replaceChunksForGeneration(
    sourceId: string,
    corpusGenerationId: string,
    chunks: readonly StagedKnowledgeChunk[],
  ): number {
    this.deleteBySourceIdAndGeneration(sourceId, corpusGenerationId)
    for (const chunk of chunks) {
      const stored: KnowledgeChunk = {
        chunkId: `knowledge_chunk_${crypto.randomUUID()}`,
        sourceId: chunk.sourceId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        embedding: [...chunk.embedding],
        embeddingProfileId: chunk.embeddingProfileId,
        corpusGenerationId: chunk.corpusGenerationId,
        ...(chunk.metadata !== undefined ? { metadata: { ...chunk.metadata } } : {}),
        ...(chunk.visibleToAvatarIds !== undefined
          ? { visibleToAvatarIds: [...chunk.visibleToAvatarIds] }
          : {}),
        createdAt: new Date().toISOString(),
      }
      this.chunks.set(stored.chunkId, stored)
    }
    return chunks.length
  }

  setActiveCorpus(activeCorpus: ActiveCorpus | null): void {
    this.activeCorpus = activeCorpus
  }

  listAllBySourceIds(sourceIds: readonly string[]): KnowledgeChunk[] {
    const sourceSet = new Set(sourceIds)
    return [...this.chunks.values()].filter((chunk) => sourceSet.has(chunk.sourceId))
  }

  private isVisibleInActiveCorpus(chunk: KnowledgeChunk): boolean {
    if (this.activeCorpus === null) return chunk.corpusGenerationId === undefined
    return (
      chunk.corpusGenerationId === this.activeCorpus.corpusGenerationId &&
      chunk.embeddingProfileId === this.activeCorpus.embeddingProfileId
    )
  }
}

function validateVectorSearchRequest(request: VectorSearchRequest): void {
  if (
    !Number.isInteger(request.candidateLimit) ||
    request.candidateLimit <= 0 ||
    request.candidateLimit > MAX_VECTOR_SEARCH_CANDIDATES
  ) {
    throw new KnowledgeVectorSearchError({ code: 'vector_search_failed', retryable: false })
  }
  if (
    request.queryVector.length !== request.profile.dimensions ||
    request.queryVector.some((value) => !Number.isFinite(value)) ||
    request.queryVector.every((value) => value === 0)
  ) {
    throw new KnowledgeVectorSearchError({ code: 'incompatible_dimension', retryable: false })
  }
}

function memoryMetadataMatches(chunk: KnowledgeChunk, request: VectorSearchRequest): boolean {
  if (request.knowledgeType !== 'memory') return true
  return (
    metadataMatchesWhenPresent(chunk.metadata, 'userId', request.userId) &&
    metadataMatchesWhenPresent(chunk.metadata, 'sessionId', request.sessionId) &&
    metadataMatchesWhenPresent(chunk.metadata, 'conversationId', request.conversationId)
  )
}

function hasEmptySourceScope(request: VectorSearchRequest): boolean {
  return request.eligibleSourceIds !== undefined && request.eligibleSourceIds.length === 0
}

function filterEligibleSources(
  sources: KnowledgeSource[],
  request: VectorSearchRequest,
): KnowledgeSource[] {
  return sources.filter(
    (source) =>
      source.scenarioId === request.scenarioId &&
      source.knowledgeType === request.knowledgeType &&
      source.status === 'ready',
  )
}

function isEligibleVectorChunk(
  chunk: KnowledgeChunk,
  request: VectorSearchRequest,
  eligibleSourceIds: readonly string[],
  sourceById: ReadonlyMap<string, KnowledgeSource>,
): boolean {
  return (
    eligibleSourceIds.includes(chunk.sourceId) &&
    sourceById.has(chunk.sourceId) &&
    chunk.embedding !== undefined &&
    chunk.embeddingProfileId === request.embeddingProfileId &&
    chunk.corpusGenerationId === request.corpusGenerationId &&
    chunk.embedding.length === request.profile.dimensions &&
    chunk.embedding.every((value) => Number.isFinite(value))
  )
}

function assertMatchingActiveCorpus(
  activeCorpus: ActiveCorpus | null,
  request: VectorSearchRequest,
): void {
  if (activeCorpus === null) return
  if (
    activeCorpus.embeddingProfileId !== request.embeddingProfileId ||
    activeCorpus.corpusGenerationId !== request.corpusGenerationId ||
    activeCorpus.profile.provider !== request.profile.provider ||
    activeCorpus.profile.model !== request.profile.model ||
    activeCorpus.profile.dimensions !== request.profile.dimensions
  ) {
    throw new KnowledgeVectorSearchError({ code: 'incompatible_profile', retryable: false })
  }
}

async function findVectorSources(
  sourceRepository: Pick<IKnowledgeSourceRepository, 'findById' | 'listByScenario'>,
  request: VectorSearchRequest,
): Promise<KnowledgeSource[]> {
  if (request.eligibleSourceIds === undefined) {
    return sourceRepository.listByScenario({
      scenarioId: request.scenarioId,
      knowledgeType: request.knowledgeType,
      status: 'ready',
    })
  }
  const found = await Promise.all(
    request.eligibleSourceIds.map((sourceId) => sourceRepository.findById(sourceId)),
  )
  return found.filter((source): source is KnowledgeSource => source !== null)
}

function isVisibleVectorChunk(
  chunk: KnowledgeChunk,
  request: VectorSearchRequest,
  sourceById: ReadonlyMap<string, KnowledgeSource>,
): boolean {
  const source = sourceById.get(chunk.sourceId)
  if (source === undefined) return false
  return isKnowledgeVisibleToAvatar(
    buildKnowledgeVisibilitySelection(
      source.visibilityPolicy,
      normalizeVisibleToAvatarIds(chunk.visibleToAvatarIds) ?? source.visibleToAvatarIds,
    ),
    request.activeAvatarId,
    request.visibilityMode === 'gm_unrestricted',
  )
}

function compareVectorChunks(
  left: { chunk: KnowledgeChunk; distance: number },
  right: { chunk: KnowledgeChunk; distance: number },
): number {
  if (left.distance !== right.distance) return left.distance - right.distance
  if (left.chunk.sourceId !== right.chunk.sourceId) {
    return left.chunk.sourceId.localeCompare(right.chunk.sourceId)
  }
  if (left.chunk.chunkIndex !== right.chunk.chunkIndex) {
    return left.chunk.chunkIndex - right.chunk.chunkIndex
  }
  return left.chunk.chunkId.localeCompare(right.chunk.chunkId)
}

function toVectorCandidate(chunk: KnowledgeChunk, distance: number, request: VectorSearchRequest) {
  const visibleToAvatarIds = normalizeVisibleToAvatarIds(chunk.visibleToAvatarIds)
  return {
    sourceId: chunk.sourceId,
    chunkId: chunk.chunkId,
    knowledgeType: request.knowledgeType,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    distance,
    similarity: 1 - distance,
    matchedQuery: request.queryVariant,
    ...(request.queryIndex !== undefined ? { queryIndex: request.queryIndex } : {}),
    ...(chunk.metadata !== undefined ? { metadata: chunk.metadata } : {}),
    ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
  }
}

function metadataMatchesWhenPresent(
  metadata: Record<string, unknown> | undefined,
  key: string,
  expected: string | undefined,
): boolean {
  if (expected === undefined || metadata === undefined || !Object.hasOwn(metadata, key)) return true
  return metadata[key] === expected
}

function vectorNorm(vector: readonly number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
}

function cosineDistance(
  queryVector: readonly number[],
  queryNorm: number,
  candidateVector: readonly number[],
): number {
  const candidateNorm = vectorNorm(candidateVector)
  if (queryNorm === 0 || candidateNorm === 0) return 1
  const dot = queryVector.reduce(
    (sum, value, index) => sum + value * (candidateVector[index] ?? 0),
    0,
  )
  return 1 - dot / (queryNorm * candidateNorm)
}
