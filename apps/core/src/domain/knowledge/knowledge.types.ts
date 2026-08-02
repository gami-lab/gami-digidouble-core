import type {
  IngestionJobStatus as SharedIngestionJobStatus,
  KnowledgeSourceFormat as SharedKnowledgeSourceFormat,
  KnowledgeSourceStatus as SharedKnowledgeSourceStatus,
  KnowledgeType as SharedKnowledgeType,
  KnowledgeVisibilityPolicy as SharedKnowledgeVisibilityPolicy,
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
  embedding?: number[]
  createdAt: string
  metadata?: Record<string, unknown>
  /**
   * Optional chunk-level override.
   * Undefined or empty => inherit/default to visible to all.
   */
  visibleToAvatarIds?: string[]
}

export type RetrievalQuerySource =
  | 'gm_guideline'
  | 'gm_retrieval_query'
  | 'gm_required_fact'
  | 'last_user_input'
  | 'working_memory'
  | 'world_context'
  | 'direct_query'

export type RetrievalQueryVariant = {
  source: RetrievalQuerySource
  text: string
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
  score?: number
  reason?: string
  matchedQuery?: RetrievalQueryVariant
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
}

export interface TypedRetrievalResult {
  memory: RetrievedKnowledgeItem[]
  world: RetrievedKnowledgeItem[]
  media: RetrievedKnowledgeItem[]
  trace: {
    query: string
    queries?: RetrievalQueryVariant[]
    perType: Record<
      KnowledgeType,
      {
        sourceIds: string[]
        selectedChunkIds: string[]
        visibility?: {
          activeAvatarId?: string
          consideredChunkCount: number
          excludedChunkCount: number
        }
      }
    >
  }
}
