import type {
  IngestionJobStatus as SharedIngestionJobStatus,
  KnowledgeSourceFormat as SharedKnowledgeSourceFormat,
  KnowledgeSourceStatus as SharedKnowledgeSourceStatus,
  KnowledgeType as SharedKnowledgeType,
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
}

export interface IngestionJob {
  ingestionJobId: string
  sourceId: string
  status: IngestionJobStatus
  attempts: number
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
  metadata?: Record<string, unknown>
}

export interface TypedRetrievalResult {
  memory: RetrievedKnowledgeItem[]
  world: RetrievedKnowledgeItem[]
  media: RetrievedKnowledgeItem[]
  trace: {
    query: string
    perType: Record<
      KnowledgeType,
      {
        sourceIds: string[]
        selectedChunkIds: string[]
      }
    >
  }
}
