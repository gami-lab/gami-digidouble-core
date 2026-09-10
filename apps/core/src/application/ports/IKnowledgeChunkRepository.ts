import type { EmbeddingProfile } from './IEmbeddingAdapter.js'
import type {
  EmbeddingVector,
  KnowledgeChunk,
  KnowledgeType,
  RetrievalFailure,
  RetrievalQueryVariant,
  RetrievalVisibilityMode,
  VectorRetrievalCandidate,
} from '../../domain/knowledge/knowledge.types.js'

export type CreateKnowledgeChunkParams = {
  sourceId: string
  content: string
  chunkIndex: number
  embedding?: EmbeddingVector
  embeddingProfileId?: string
  corpusGenerationId?: string
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
}

export const MAX_VECTOR_SEARCH_CANDIDATES = 100

/** All scope needed to execute one bounded, profile-compatible vector search. */
export type VectorSearchRequest = Readonly<{
  queryVector: EmbeddingVector
  queryVariant: RetrievalQueryVariant
  queryIndex?: number
  scenarioId: string
  knowledgeType: KnowledgeType
  candidateLimit: number
  embeddingProfileId: string
  corpusGenerationId: string
  profile: EmbeddingProfile
  visibilityMode: RetrievalVisibilityMode
  activeAvatarId?: string
  eligibleSourceIds?: readonly string[]
}>

export type VectorSearchResult = readonly VectorRetrievalCandidate[]

/** Safe, finite failure boundary for vector retrieval infrastructure. */
export class KnowledgeVectorSearchError extends Error {
  readonly failure: RetrievalFailure

  constructor(failure: RetrievalFailure) {
    super(`Vector search failed: ${failure.code}.`)
    this.name = 'KnowledgeVectorSearchError'
    this.failure = failure
  }
}

export interface IKnowledgeChunkRepository {
  create(params: CreateKnowledgeChunkParams): Promise<KnowledgeChunk>
  listBySourceId(sourceId: string): Promise<KnowledgeChunk[]>
  listBySourceIds(sourceIds: string[]): Promise<KnowledgeChunk[]>
  searchByVector(request: VectorSearchRequest): Promise<VectorSearchResult>
  deleteBySourceId(sourceId: string): Promise<number>
}
