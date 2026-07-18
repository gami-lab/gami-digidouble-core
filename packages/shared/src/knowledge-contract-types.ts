/**
 * Canonical shared HTTP knowledge and retrieval contract fragments.
 *
 * Ownership:
 * - Internal/domain knowledge contracts: apps/core/src/domain/knowledge/knowledge.types.ts
 * - HTTP/DTO knowledge contracts: this file (+ composed response DTOs in shared)
 */

export type KnowledgeType = 'memory' | 'world' | 'media'

export type KnowledgeSourceFormat = 'pdf' | 'text' | 'markdown' | 'url' | 'media'

export type KnowledgeSourceStatus = 'pending' | 'ready' | 'error'

export type IngestionJobStatus = 'queued' | 'running' | 'completed' | 'failed'

/**
 * Explicit visibility policy for a knowledge source.
 *
 * - `'all'`     — visible to all avatars (default / backward-compatible)
 * - `'avatars'` — visible only to the avatar IDs listed in `visibleToAvatarIds`
 * - `'none'`    — GM-only: not visible to any avatar in retrieval; GM omniscience bypasses this
 */
export type KnowledgeVisibilityPolicy = 'all' | 'avatars' | 'none'

export type KnowledgeSourceDto = {
  sourceId: string
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeSourceFormat
  uriOrPath: string
  status: KnowledgeSourceStatus
  metadata?: Record<string, unknown>
  visibilityPolicy?: KnowledgeVisibilityPolicy
  visibleToAvatarIds?: string[]
  createdAt: string
}

export type KnowledgeChunkDto = {
  chunkId: string
  sourceId: string
  content: string
  chunkIndex: number
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
  createdAt: string
}

export type IngestionJobDto = {
  ingestionJobId: string
  sourceId: string
  status: IngestionJobStatus
  attempts: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  createdAt: string
}

export type RetrievedKnowledgeItemDto = {
  sourceId: string
  chunkId: string
  knowledgeType: KnowledgeType
  content: string
  score?: number
  reason?: string
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
}

export type SharedContextScenarioSnapshot = {
  scenarioId: string
  name?: string
  description?: string
  goals?: string[]
}

export type SharedAvatarContextKnowledgeInjection = {
  retrievedItems: RetrievedKnowledgeItemDto[]
  typedSections?: SharedTypedKnowledgeSections
}

export type SharedTypedKnowledgeSections = {
  memory: RetrievedKnowledgeItemDto[]
  world: RetrievedKnowledgeItemDto[]
  media: RetrievedKnowledgeItemDto[]
}

export type SharedGmContextKnowledgeInjection = SharedTypedKnowledgeSections

export type RecordedKnowledgeReferenceDto = {
  sourceId: string
  chunkId: string
  knowledgeType: KnowledgeType
  score?: number
  reason?: string
  visibleToAvatarIds?: string[]
}

export type RecordedTypedKnowledgeSections = {
  memory: RecordedKnowledgeReferenceDto[]
  world: RecordedKnowledgeReferenceDto[]
  media: RecordedKnowledgeReferenceDto[]
}

export type RecordedAvatarContextKnowledgeInjection = RecordedTypedKnowledgeSections

export type RecordedGmContextKnowledgeInjection = RecordedTypedKnowledgeSections

/**
 * Canonical shared API DTOs for EPIC 5.1 knowledge endpoints.
 * Keep API-facing request/response contracts here to avoid route-local copies.
 */
export type CreateKnowledgeSourceRequest = {
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeSourceFormat
  uriOrPath: string
  metadata?: Record<string, unknown>
  visibilityPolicy?: KnowledgeVisibilityPolicy
  visibleToAvatarIds?: string[]
}

export type CreateKnowledgeSourceResponse = {
  source: KnowledgeSourceDto
}

export type ListKnowledgeSourcesQuery = {
  knowledgeType?: KnowledgeType
  status?: KnowledgeSourceStatus
}

export type ListKnowledgeSourcesResponse = {
  sources: KnowledgeSourceDto[]
}

export type UpdateKnowledgeSourceRequest = {
  name?: string
  metadata?: Record<string, unknown>
  visibilityPolicy?: KnowledgeVisibilityPolicy
  visibleToAvatarIds?: string[]
  uriOrPath?: string
  /**
   * Optional replacement file payload for existing PDF/TXT-backed sources.
   * `content` and `filename` must be provided together.
   */
  content?: string
  filename?: string
}

export type UpdateKnowledgeSourceResponse = {
  source: KnowledgeSourceDto
}

export type DeleteKnowledgeSourceResponse = {
  sourceId: string
  deleted: boolean
}

/**
 * Upload a PDF or TXT file as a knowledge source.
 * `content` is the base64-encoded raw file bytes.
 * `filename` determines format (.pdf / .txt / .text).
 */
export type UploadKnowledgeSourceRequest = {
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  content: string
  filename: string
  visibilityPolicy?: KnowledgeVisibilityPolicy
  visibleToAvatarIds?: string[]
}

export type UploadKnowledgeSourceResponse = {
  source: KnowledgeSourceDto
}

export type TriggerIngestionRequest = {
  correlationId?: string
}

export type TriggerIngestionResponse = {
  ingestionJob: IngestionJobDto
  scheduled: boolean
}

export type GetIngestionJobResponse = {
  ingestionJob: IngestionJobDto
}

export type ListIngestionJobsResponse = {
  jobs: IngestionJobDto[]
}

export type ListKnowledgeChunksResponse = {
  chunks: KnowledgeChunkDto[]
}

export type QueryKnowledgeRetrievalRequest = {
  scenarioId: string
  query: string
  sessionId?: string
  userId?: string
  conversationId?: string
  activeAvatarId?: string
  limitPerType?: number
}

export type TypedKnowledgeRetrievalDto = {
  memory: RetrievedKnowledgeItemDto[]
  world: RetrievedKnowledgeItemDto[]
  media: RetrievedKnowledgeItemDto[]
  trace: {
    query: string
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

export type QueryKnowledgeRetrievalResponse = {
  retrieval: TypedKnowledgeRetrievalDto
}
