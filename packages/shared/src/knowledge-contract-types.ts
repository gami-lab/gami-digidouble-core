/**
 * Canonical shared HTTP knowledge and retrieval contract fragments.
 *
 * Ownership:
 * - Internal/domain knowledge contracts: apps/core/src/domain/knowledge/knowledge.types.ts
 * - HTTP/DTO knowledge contracts: this file (+ composed response DTOs in shared)
 */

/** Canonical static-knowledge categories shared by HTTP and internal mappings. */
export const KNOWLEDGE_TYPES = ['avatar_knowledge', 'world', 'media'] as const

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number]

/**
 * Temporary API input compatibility. This alias is normalized at the API boundary and is never
 * persisted or emitted in a response.
 */
export const KNOWLEDGE_TYPE_INPUTS = [...KNOWLEDGE_TYPES, 'memory'] as const
export type KnowledgeTypeInput = (typeof KNOWLEDGE_TYPE_INPUTS)[number]
export const LEGACY_KNOWLEDGE_TYPE_ALIAS = 'memory' as const

export type KnowledgeSourceFormat = 'pdf' | 'text' | 'markdown' | 'url' | 'media'

export type KnowledgeSourceStatus = 'pending' | 'ready' | 'error' | 'blocked'

export type IngestionJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export const INGESTION_CHUNK_SIZE_MIN = 100
export const INGESTION_CHUNK_SIZE_MAX = 10_000
export const INGESTION_CHUNK_SIZE_DEFAULT = 1500

/**
 * Explicit visibility policy for a knowledge source.
 *
 * - `'all'`     — visible to all avatars (default / backward-compatible)
 * - `'avatars'` — visible only to the avatar IDs listed in `visibleToAvatarIds`
 * - `'none'`    — GM-only: not visible to any avatar in retrieval; GM omniscience bypasses this
 */
export type KnowledgeVisibilityPolicy = 'all' | 'avatars' | 'none'

/** Canonical origins for retrieval query variants across internal and public contracts. */
export type RetrievalQuerySource =
  | 'gm_guideline'
  | 'gm_retrieval_query'
  | 'gm_required_fact'
  | 'last_user_input'
  | 'working_memory'
  | 'world_context'
  | 'direct_query'

export const RETRIEVAL_QUERY_SOURCES: readonly RetrievalQuerySource[] = [
  'gm_guideline',
  'gm_retrieval_query',
  'gm_required_fact',
  'last_user_input',
  'working_memory',
  'world_context',
  'direct_query',
]

export function isRetrievalQuerySource(value: unknown): value is RetrievalQuerySource {
  return typeof value === 'string' && (RETRIEVAL_QUERY_SOURCES as readonly string[]).includes(value)
}

/** A bounded query input; `queryIndex` identifies its position in the retrieval request. */
export type RetrievalQueryVariant = {
  source: RetrievalQuerySource
  text: string
  queryIndex?: number
}

export type RetrievalVisibilityMode = 'avatar_filtered' | 'gm_unrestricted'

export type RetrievalOutcomeCode = 'success' | 'no_results' | 'failed'

export const RETRIEVAL_OUTCOME_CODES: readonly RetrievalOutcomeCode[] = [
  'success',
  'no_results',
  'failed',
]

export function isRetrievalOutcomeCode(value: unknown): value is RetrievalOutcomeCode {
  return typeof value === 'string' && (RETRIEVAL_OUTCOME_CODES as readonly string[]).includes(value)
}

export type RetrievalFailureCode =
  | 'query_embedding_failed'
  | 'incompatible_profile'
  | 'incompatible_dimension'
  | 'vector_search_failed'

export const RETRIEVAL_FAILURE_CODES: readonly RetrievalFailureCode[] = [
  'query_embedding_failed',
  'incompatible_profile',
  'incompatible_dimension',
  'vector_search_failed',
]

export function isRetrievalFailureCode(value: unknown): value is RetrievalFailureCode {
  return typeof value === 'string' && (RETRIEVAL_FAILURE_CODES as readonly string[]).includes(value)
}

export type RetrievalFailureDto = {
  code: RetrievalFailureCode
  retryable: boolean
}

export type RetrievalEmbeddingProfileDto = KnowledgeEmbeddingProfileDto & {
  embeddingProfileId?: string
  corpusGenerationId?: string
}

export type RetrievalTimingsDto = {
  totalMs?: number
  queryEmbeddingMs?: number
  vectorSearchMs?: number
}

export type RetrievalCountsDto = {
  candidateCount?: number
  selectedCount?: number
  /** Candidates removed because the same chunk matched more than one query variant. */
  duplicateCount?: number
  /** Candidates removed by bounded retrieval selection after variant merging. */
  selectionExcludedCount?: number
  /** Eligibility rows excluded by the repository, when a bounded count is available. */
  eligibilityExcludedCount?: number
  /** Compatibility aggregate of all bounded exclusions reported by retrieval. */
  excludedCount?: number
}

export type RetrievalVisibilityDto = {
  mode?: RetrievalVisibilityMode
  activeAvatarId?: string
  consideredChunkCount: number
  excludedChunkCount: number
}

export type RetrievalTracePerTypeDto = RetrievalCountsDto & {
  sourceIds: string[]
  selectedChunkIds: string[]
  visibility?: RetrievalVisibilityDto
}

/** Safe, bounded retrieval diagnostics. Raw query vectors and provider payloads are excluded. */
export type RetrievalTraceDto = RetrievalCountsDto & {
  query: string
  queries?: RetrievalQueryVariant[]
  queryVectorCount?: number
  embeddingProfile?: RetrievalEmbeddingProfileDto
  timings?: RetrievalTimingsDto
  visibilityMode?: RetrievalVisibilityMode
  /** Explicit visibility bypass state; never inferred from a missing avatar ID. */
  gmUnrestricted?: boolean
  outcome?: RetrievalOutcomeCode
  failure?: RetrievalFailureDto
  perType: Record<KnowledgeType, RetrievalTracePerTypeDto>
}

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
  chunkSize?: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  createdAt: string
}

export type KnowledgeEmbeddingProfileDto = {
  provider: string
  model: string
  dimensions: number
}

export type KnowledgeReindexOperationStatus = 'pending' | 'running' | 'completed' | 'failed'

export type KnowledgeReindexSourceStatus = 'pending' | 'running' | 'completed' | 'failed'

export type KnowledgeReindexOperationDto = {
  reindexOperationId: string
  corpusGenerationId: string
  embeddingProfileId: string
  profile: KnowledgeEmbeddingProfileDto
  status: KnowledgeReindexOperationStatus
  attempts: number
  expectedSourceCount: number
  completedSourceCount: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  failureDetails?: string
}

export type KnowledgeReindexSourceProgressDto = {
  reindexOperationId: string
  sourceId: string
  status: KnowledgeReindexSourceStatus
  attempts: number
  expectedChunkCount?: number
  completedChunkCount: number
  startedAt?: string
  completedAt?: string
  failureDetails?: string
}

export type StartKnowledgeReindexResponse = {
  status: 'started' | 'reused' | 'already_active'
  operation: KnowledgeReindexOperationDto | null
}

export type GetKnowledgeReindexResponse = {
  operation: KnowledgeReindexOperationDto
  sources: KnowledgeReindexSourceProgressDto[]
}

export type RetryKnowledgeReindexResponse = {
  operation: KnowledgeReindexOperationDto
}

export type KnowledgeRetrievalReferenceDto = {
  sourceId: string
  chunkId: string
  knowledgeType: KnowledgeType
  score?: number
  /** Compatibility ranking field carrying normalized cosine similarity. */
  distance?: number
  similarity?: number
  queryIndex?: number
  reason?: string
  matchedQuery?: RetrievalQueryVariant
  visibleToAvatarIds?: string[]
}

export type RetrievedKnowledgeItemDto = KnowledgeRetrievalReferenceDto & {
  content: string
  metadata?: Record<string, unknown>
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
  avatar_knowledge: RetrievedKnowledgeItemDto[]
  world: RetrievedKnowledgeItemDto[]
  media: RetrievedKnowledgeItemDto[]
  /** Optional safe retrieval diagnostics for runtime inspection. */
  trace?: RetrievalTraceDto
}

export type SharedGmContextKnowledgeInjection = SharedTypedKnowledgeSections

export type RecordedKnowledgeReferenceDto = KnowledgeRetrievalReferenceDto & {
  content?: string
}

export type RecordedTypedKnowledgeSections = {
  avatar_knowledge: RecordedKnowledgeReferenceDto[]
  world: RecordedKnowledgeReferenceDto[]
  media: RecordedKnowledgeReferenceDto[]
  trace?: RetrievalTraceDto
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
  knowledgeType: KnowledgeTypeInput
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
  knowledgeType?: KnowledgeTypeInput
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
  knowledgeType: KnowledgeTypeInput
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
  chunkSize?: number
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
  avatar_knowledge: RetrievedKnowledgeItemDto[]
  world: RetrievedKnowledgeItemDto[]
  media: RetrievedKnowledgeItemDto[]
  trace: RetrievalTraceDto
}

export type QueryKnowledgeRetrievalResponse = {
  retrieval: TypedKnowledgeRetrievalDto
}
