import type {
  IngestionJobStatus as SharedIngestionJobStatus,
  KnowledgeSourceFormat as SharedKnowledgeSourceFormat,
  KnowledgeSourceStatus as SharedKnowledgeSourceStatus,
  KnowledgeType as SharedKnowledgeType,
  KnowledgeVisibilityPolicy as SharedKnowledgeVisibilityPolicy,
  RetrievalFailureCode as SharedRetrievalFailureCode,
  RetrievalOutcomeCode as SharedRetrievalOutcomeCode,
  RetrievalQuerySource as SharedRetrievalQuerySource,
  RetrievalQueryVariant as SharedRetrievalQueryVariant,
  RetrievalVisibilityMode as SharedRetrievalVisibilityMode,
} from '@gami/shared'

/**
 * Knowledge domain contracts.
 *
 * Ownership:
 * - Domain/internal knowledge contracts: this file.
 * - HTTP/shared DTO contracts: packages/shared/src/knowledge-contract-types.ts.
 */

export type KnowledgeType = SharedKnowledgeType

export type KnowledgeSourceFormat = SharedKnowledgeSourceFormat

export type KnowledgeSourceStatus = SharedKnowledgeSourceStatus

export type IngestionJobStatus = SharedIngestionJobStatus

export type KnowledgeVisibilityPolicy = SharedKnowledgeVisibilityPolicy

/** Vector values are immutable at the domain boundary. */
export type EmbeddingVector = readonly number[]

export interface KnowledgeSource {
  sourceId: string
  scenarioId: string
  name: string
  /** Retrieval domain classification used by EPIC 5.1. */
  knowledgeType: KnowledgeType
  /** Input/source representation (file or URI flavor). */
  format: KnowledgeSourceFormat
  uriOrPath: string
  status: KnowledgeSourceStatus
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
  /**
   * Explicit visibility policy for EPIC 6.1.
   * - `'all'`     — visible to all avatars (default when absent)
   * - `'avatars'` — visible only to IDs in `visibleToAvatarIds`
   * - `'none'`    — GM-only; no avatar retrieval regardless of `visibleToAvatarIds`
   */
  visibilityPolicy?: KnowledgeVisibilityPolicy
  /**
   * Avatar visibility scope for EPIC 5.1b.
   * Relevant when `visibilityPolicy` is `'avatars'`.
   * Undefined or empty (with `'all'` policy) => visible to all avatars.
   */
  visibleToAvatarIds?: string[]
}

export interface KnowledgeChunk {
  chunkId: string
  sourceId: string
  content: string
  /** Index of the chunk within the source document. */
  chunkIndex: number
  /** Embedding vector for retrieval (when available). */
  embedding?: EmbeddingVector
  /** Persisted embedding profile identity for vectorized chunks. */
  embeddingProfileId?: string
  /** Immutable corpus generation that owns the vector. */
  corpusGenerationId?: string
  createdAt: string
  metadata?: Record<string, unknown>
  /**
   * Optional chunk-level override.
   * Undefined or empty => inherit/default to visible to all.
   */
  visibleToAvatarIds?: string[]
}

/** Canonical retrieval query contracts are shared with the safe API projections. */
export type RetrievalQuerySource = SharedRetrievalQuerySource

export type RetrievalQueryVariant = SharedRetrievalQueryVariant

export type RetrievalVisibilityMode = SharedRetrievalVisibilityMode

export type RetrievalOutcomeCode = SharedRetrievalOutcomeCode

export type RetrievalFailureCode = SharedRetrievalFailureCode

export type RetrievalFailure = Readonly<{
  code: RetrievalFailureCode
  retryable: boolean
}>

export type RetrievalEmbeddingProfile = Readonly<{
  embeddingProfileId?: string
  corpusGenerationId?: string
  provider: string
  model: string
  dimensions: number
}>

export type RetrievalTimings = Readonly<{
  totalMs?: number
  queryEmbeddingMs?: number
  vectorSearchMs?: number
}>

export type RetrievalCounts = Readonly<{
  candidateCount?: number
  selectedCount?: number
  excludedCount?: number
}>

export type RetrievalVisibilityTrace = Readonly<{
  mode?: RetrievalVisibilityMode
  activeAvatarId?: string
  consideredChunkCount: number
  excludedChunkCount: number
}>

export type RetrievalTypeTrace = RetrievalCounts & {
  sourceIds: string[]
  selectedChunkIds: string[]
  visibility?: RetrievalVisibilityTrace
}

export type RetrievalTrace = RetrievalCounts & {
  query: string
  queries?: RetrievalQueryVariant[]
  embeddingProfile?: RetrievalEmbeddingProfile
  timings?: RetrievalTimings
  visibilityMode?: RetrievalVisibilityMode
  outcome?: RetrievalOutcomeCode
  failure?: RetrievalFailure
  perType: Record<KnowledgeType, RetrievalTypeTrace>
}

export interface IngestionJob {
  ingestionJobId: string
  sourceId: string
  status: IngestionJobStatus
  attempts: number
  chunkSize?: number
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

export interface RetrievedKnowledgeItem {
  sourceId: string
  chunkId: string
  knowledgeType: KnowledgeType
  content: string
  /** Legacy lexical score retained for backward compatibility. */
  score?: number
  /** pgvector cosine distance; lower values are better. */
  distance?: number
  /** Normalized cosine similarity (`1 - distance`); higher values are better. */
  similarity?: number
  queryIndex?: number
  reason?: string
  matchedQuery?: RetrievalQueryVariant
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
}

/** Internal candidate returned by vector retrieval before bounded selection. */
export interface VectorRetrievalCandidate {
  sourceId: string
  chunkId: string
  knowledgeType: KnowledgeType
  content: string
  chunkIndex: number
  distance: number
  similarity: number
  matchedQuery: RetrievalQueryVariant
  queryIndex?: number
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
}

export interface TypedRetrievalResult {
  memory: RetrievedKnowledgeItem[]
  world: RetrievedKnowledgeItem[]
  media: RetrievedKnowledgeItem[]
  trace: RetrievalTrace
}
