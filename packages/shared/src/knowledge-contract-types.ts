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

export type KnowledgeSourceDto = {
  sourceId: string
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeSourceFormat
  uriOrPath: string
  status: KnowledgeSourceStatus
  metadata?: Record<string, unknown>
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

export type RecordedAvatarContextKnowledgeInjection = {
  typedSections?: RecordedTypedKnowledgeSections
}

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
