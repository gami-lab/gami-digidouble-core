import type {
  IKnowledgeChunkRepository,
  VectorSearchResult,
} from '../../ports/IKnowledgeChunkRepository.js'
import {
  KnowledgeVectorSearchError,
  MAX_VECTOR_SEARCH_CANDIDATES,
} from '../../ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type {
  KnowledgeType,
  RetrievalEmbeddingProfile,
  RetrievalFailure,
  RetrievalTimings,
  RetrievalVisibilityMode,
  RetrievedKnowledgeItem,
  TypedRetrievalResult,
  VectorRetrievalCandidate,
} from '../../../domain/knowledge/knowledge.types.js'
import { selectBalancedRetrievedItems } from '../../../domain/knowledge/retrieval-selection.js'
import type {
  KnowledgeQueryEmbeddingService,
  RetrievalQueryEmbeddingResult,
  RetrievalQueryVector,
} from './knowledge-query-embedding.service.js'
import type { TypedRetrievalQueryVariant } from './typed-retrieval-query-builder.js'

const DEFAULT_LIMIT_PER_TYPE = 3
const RETRIEVAL_TYPES: readonly KnowledgeType[] = ['memory', 'world', 'media']
type QueryEmbeddingService = Pick<KnowledgeQueryEmbeddingService, 'embedVariants'>
type ResolvedRetrievalEmbeddingProfile = RetrievalEmbeddingProfile & {
  embeddingProfileId: string
  corpusGenerationId: string
}

export type TypedRetrievalInput = {
  scenarioId: string
  sessionId?: string
  userId?: string
  conversationId?: string
  activeAvatarId?: string
  bypassVisibilityFilter?: boolean
  query: string
  queries?: TypedRetrievalQueryVariant[]
  limitPerType?: number
}

type RetrievedType = {
  sourceIds: string[]
  items: RetrievedKnowledgeItem[]
  candidateCount: number
  duplicateCount: number
  selectionExcludedCount: number
  excludedCount: number
  visibility: {
    mode: RetrievalVisibilityMode
    activeAvatarId?: string
    consideredChunkCount: number
    excludedChunkCount: number
  }
}

export class TypedRetrievalService {
  constructor(
    private readonly sourceRepository: IKnowledgeSourceRepository,
    private readonly chunkRepository: IKnowledgeChunkRepository,
    private readonly queryEmbeddingService: QueryEmbeddingService,
  ) {}

  // eslint-disable-next-line complexity, max-lines-per-function
  async retrieve(input: TypedRetrievalInput): Promise<TypedRetrievalResult> {
    const startedAt = Date.now()
    const limit = Math.min(
      MAX_VECTOR_SEARCH_CANDIDATES,
      Math.max(1, input.limitPerType ?? DEFAULT_LIMIT_PER_TYPE),
    )
    const embedding = await this.queryEmbeddingService.embedVariants({
      query: input.query,
      ...(input.queries !== undefined ? { queries: input.queries } : {}),
    })

    if (embedding.diagnostics.outcome === 'failed') {
      return emptyRetrievalResult(
        input,
        embedding,
        embedding.diagnostics.failure ?? {
          code: 'query_embedding_failed',
          retryable: false,
        },
      )
    }
    if (embedding.queryVectors.length === 0) {
      return emptyRetrievalResult(input, embedding)
    }

    const profile = embedding.diagnostics.embeddingProfile
    const embeddingProfileId = profile?.embeddingProfileId
    const corpusGenerationId = profile?.corpusGenerationId
    if (
      profile === undefined ||
      embeddingProfileId === undefined ||
      corpusGenerationId === undefined
    ) {
      return emptyRetrievalResult(input, embedding, {
        code: 'incompatible_profile',
        retryable: false,
      })
    }
    const resolvedProfile: ResolvedRetrievalEmbeddingProfile = {
      ...profile,
      embeddingProfileId,
      corpusGenerationId,
    }

    try {
      const retrievedByType = await Promise.all(
        RETRIEVAL_TYPES.map((type) =>
          this.retrieveByType(type, input, embedding.queryVectors, resolvedProfile, limit),
        ),
      )
      const [memory, world, media] = retrievedByType as [
        RetrievedType,
        RetrievedType,
        RetrievedType,
      ]
      const totalSelected = memory.items.length + world.items.length + media.items.length
      const vectorSearchMs = Math.max(
        0,
        Date.now() - startedAt - (embedding.diagnostics.timings.totalMs ?? 0),
      )

      return {
        memory: memory.items,
        world: world.items,
        media: media.items,
        trace: {
          query: input.query,
          queries: [...embedding.queries],
          queryVectorCount: embedding.diagnostics.queryVectorCount,
          embeddingProfile: profile,
          timings: retrievalTimings(
            embedding.diagnostics.timings,
            vectorSearchMs,
            Date.now() - startedAt,
          ),
          visibilityMode: visibilityMode(input),
          gmUnrestricted: input.bypassVisibilityFilter === true,
          candidateCount: memory.candidateCount + world.candidateCount + media.candidateCount,
          selectedCount: totalSelected,
          ...optionalCount(
            'duplicateCount',
            memory.duplicateCount + world.duplicateCount + media.duplicateCount,
          ),
          ...optionalCount(
            'selectionExcludedCount',
            memory.selectionExcludedCount +
              world.selectionExcludedCount +
              media.selectionExcludedCount,
          ),
          excludedCount: memory.excludedCount + world.excludedCount + media.excludedCount,
          outcome: totalSelected > 0 ? 'success' : 'no_results',
          perType: {
            memory: toTrace(memory),
            world: toTrace(world),
            media: toTrace(media),
          },
        },
      }
    } catch (error) {
      if (!(error instanceof KnowledgeVectorSearchError)) throw error
      return emptyRetrievalResult(input, embedding, error.failure, {
        vectorSearchMs: Math.max(
          0,
          Date.now() - startedAt - (embedding.diagnostics.timings.totalMs ?? 0),
        ),
      })
    }
  }

  private async retrieveByType(
    type: KnowledgeType,
    input: TypedRetrievalInput,
    queryVectors: readonly RetrievalQueryVector[],
    profile: ResolvedRetrievalEmbeddingProfile,
    limit: number,
  ): Promise<RetrievedType> {
    const {
      embeddingProfileId: resolvedEmbeddingProfileId,
      corpusGenerationId: resolvedCorpusGenerationId,
    } = profile
    const sources = await this.sourceRepository.listByScenario({
      scenarioId: input.scenarioId,
      knowledgeType: type,
      status: 'ready',
    })
    const sourceIds = sources.map((source) => source.sourceId)
    if (sourceIds.length === 0) return emptyType(input, sourceIds)

    const candidateLimit = Math.min(
      MAX_VECTOR_SEARCH_CANDIDATES,
      Math.max(limit, limit * queryVectors.length),
    )
    const searchResults = await Promise.all(
      queryVectors.map((queryVector) =>
        this.chunkRepository.searchByVector({
          queryVector: queryVector.vector,
          queryVariant: queryVector.variant,
          queryIndex: queryVector.queryIndex,
          scenarioId: input.scenarioId,
          knowledgeType: type,
          candidateLimit,
          embeddingProfileId: resolvedEmbeddingProfileId,
          corpusGenerationId: resolvedCorpusGenerationId,
          profile: {
            provider: profile.provider,
            model: profile.model,
            dimensions: profile.dimensions,
          },
          visibilityMode: visibilityMode(input),
          ...(input.activeAvatarId !== undefined ? { activeAvatarId: input.activeAvatarId } : {}),
          eligibleSourceIds: sourceIds,
          ...(input.userId !== undefined ? { userId: input.userId } : {}),
          ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
          ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
        }),
      ),
    )
    const candidates = searchResults.flatMap((result: VectorSearchResult) => result)
    const merged = mergeCandidates(candidates)
    const items = selectBalancedRetrievedItems(merged.map(toRetrievedItem), limit)

    return {
      sourceIds,
      items,
      candidateCount: candidates.length,
      duplicateCount: Math.max(0, candidates.length - merged.length),
      selectionExcludedCount: Math.max(0, merged.length - items.length),
      excludedCount: Math.max(0, candidates.length - items.length),
      visibility: {
        mode: visibilityMode(input),
        ...(input.activeAvatarId !== undefined ? { activeAvatarId: input.activeAvatarId } : {}),
        consideredChunkCount: candidates.length,
        excludedChunkCount: 0,
      },
    }
  }
}

function mergeCandidates(
  candidates: readonly VectorRetrievalCandidate[],
): VectorRetrievalCandidate[] {
  const bestByChunk = new Map<string, VectorRetrievalCandidate>()
  for (const candidate of candidates) {
    const existing = bestByChunk.get(candidate.chunkId)
    if (existing === undefined || compareCandidates(candidate, existing) < 0) {
      bestByChunk.set(candidate.chunkId, candidate)
    }
  }
  return [...bestByChunk.values()].sort(compareCandidates)
}

function compareCandidates(
  left: VectorRetrievalCandidate,
  right: VectorRetrievalCandidate,
): number {
  if (left.similarity !== right.similarity) return right.similarity - left.similarity
  const leftQueryIndex = left.queryIndex ?? Number.MAX_SAFE_INTEGER
  const rightQueryIndex = right.queryIndex ?? Number.MAX_SAFE_INTEGER
  if (leftQueryIndex !== rightQueryIndex) return leftQueryIndex - rightQueryIndex
  if (left.sourceId !== right.sourceId) return left.sourceId.localeCompare(right.sourceId)
  if (left.chunkIndex !== right.chunkIndex) return left.chunkIndex - right.chunkIndex
  return left.chunkId.localeCompare(right.chunkId)
}

function toRetrievedItem(candidate: VectorRetrievalCandidate): RetrievedKnowledgeItem {
  return {
    sourceId: candidate.sourceId,
    chunkId: candidate.chunkId,
    knowledgeType: candidate.knowledgeType,
    content: candidate.content,
    score: candidate.similarity,
    distance: candidate.distance,
    similarity: candidate.similarity,
    ...(candidate.queryIndex !== undefined ? { queryIndex: candidate.queryIndex } : {}),
    reason: 'vector-match',
    matchedQuery: candidate.matchedQuery,
    ...(candidate.visibleToAvatarIds !== undefined
      ? { visibleToAvatarIds: candidate.visibleToAvatarIds }
      : {}),
    ...(candidate.metadata !== undefined ? { metadata: candidate.metadata } : {}),
  }
}

function visibilityMode(input: TypedRetrievalInput): RetrievalVisibilityMode {
  return input.bypassVisibilityFilter === true ? 'gm_unrestricted' : 'avatar_filtered'
}

function emptyType(input: TypedRetrievalInput, sourceIds: string[]): RetrievedType {
  return {
    sourceIds,
    items: [],
    candidateCount: 0,
    duplicateCount: 0,
    selectionExcludedCount: 0,
    excludedCount: 0,
    visibility: {
      mode: visibilityMode(input),
      ...(input.activeAvatarId !== undefined ? { activeAvatarId: input.activeAvatarId } : {}),
      consideredChunkCount: 0,
      excludedChunkCount: 0,
    },
  }
}

function emptyRetrievalResult(
  input: TypedRetrievalInput,
  embedding: RetrievalQueryEmbeddingResult,
  failure?: RetrievalFailure,
  timing?: Pick<RetrievalTimings, 'vectorSearchMs'>,
): TypedRetrievalResult {
  const empty = emptyType(input, [])
  const timings = retrievalTimings(
    embedding.diagnostics.timings,
    timing?.vectorSearchMs ?? 0,
    (embedding.diagnostics.timings.totalMs ?? 0) + (timing?.vectorSearchMs ?? 0),
  )
  const outcome = failure === undefined ? 'no_results' : 'failed'
  return {
    memory: [],
    world: [],
    media: [],
    trace: {
      query: input.query,
      queries: [...embedding.queries],
      queryVectorCount: embedding.diagnostics.queryVectorCount,
      ...(embedding.diagnostics.embeddingProfile !== undefined
        ? { embeddingProfile: embedding.diagnostics.embeddingProfile }
        : {}),
      timings,
      visibilityMode: visibilityMode(input),
      gmUnrestricted: input.bypassVisibilityFilter === true,
      candidateCount: 0,
      selectedCount: 0,
      ...optionalCount('duplicateCount', 0),
      ...optionalCount('selectionExcludedCount', 0),
      excludedCount: 0,
      outcome,
      ...(failure === undefined ? {} : { failure }),
      perType: {
        memory: toTrace(empty),
        world: toTrace(empty),
        media: toTrace(empty),
      },
    },
  }
}

function toTrace(retrieved: RetrievedType) {
  return {
    sourceIds: retrieved.sourceIds,
    selectedChunkIds: retrieved.items.map((item) => item.chunkId),
    candidateCount: retrieved.candidateCount,
    selectedCount: retrieved.items.length,
    ...optionalCount('duplicateCount', retrieved.duplicateCount),
    ...optionalCount('selectionExcludedCount', retrieved.selectionExcludedCount),
    excludedCount: retrieved.excludedCount,
    visibility: retrieved.visibility,
  }
}

function optionalCount<K extends 'duplicateCount' | 'selectionExcludedCount'>(
  key: K,
  value: number,
): { [P in K]?: number } {
  return (value > 0 ? { [key]: value } : {}) as { [P in K]?: number }
}

function retrievalTimings(
  embeddingTimings: RetrievalTimings,
  vectorSearchMs: number,
  totalMs: number,
): RetrievalTimings {
  return {
    ...embeddingTimings,
    totalMs: Math.max(0, totalMs),
    vectorSearchMs: Math.max(0, vectorSearchMs),
  }
}
