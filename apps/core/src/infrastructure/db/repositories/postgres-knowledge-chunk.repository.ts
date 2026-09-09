import type { JSONValue, Sql } from 'postgres'
import type {
  CreateKnowledgeChunkParams,
  IKnowledgeChunkRepository,
  VectorSearchRequest,
  VectorSearchResult,
} from '../../../application/ports/IKnowledgeChunkRepository.js'
import {
  KnowledgeVectorSearchError,
  MAX_VECTOR_SEARCH_CANDIDATES,
} from '../../../application/ports/IKnowledgeChunkRepository.js'
import type {
  KnowledgeChunk,
  VectorRetrievalCandidate,
} from '../../../domain/knowledge/knowledge.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

type KnowledgeChunkDbRow = {
  id: string
  source_id: string
  content: string
  chunk_index: number
  embedding: unknown
  embedding_profile_id: string | null
  corpus_generation_id: string | null
  metadata: unknown
  visible_to_avatar_ids: string[] | null
  created_at: Date
}

type KnowledgeChunkRow = Omit<KnowledgeChunkDbRow, 'embedding'> & { embedding: number[] | null }
type SqlFragment = ReturnType<Sql['unsafe']>

type VectorSearchRow = {
  id: string
  source_id: string
  content: string
  chunk_index: number
  knowledge_type: VectorRetrievalCandidate['knowledgeType']
  distance: number | string
  metadata: unknown
  visible_to_avatar_ids: string[] | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeVisibleToAvatarIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((avatarId) => avatarId.trim())
    .filter((avatarId) => avatarId.length > 0)
  return normalized.length > 0 ? normalized : undefined
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value
  if (typeof value !== 'string') return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function rowToKnowledgeChunk(row: KnowledgeChunkRow): KnowledgeChunk {
  const visibleToAvatarIds = normalizeVisibleToAvatarIds(row.visible_to_avatar_ids)
  return {
    chunkId: `knowledge_chunk_${row.id}`,
    sourceId: `knowledge_source_${row.source_id}`,
    content: row.content,
    chunkIndex: row.chunk_index,
    ...(row.embedding !== null ? { embedding: [...row.embedding] } : {}),
    ...(row.embedding_profile_id !== null
      ? { embeddingProfileId: `embedding_profile_${row.embedding_profile_id}` }
      : {}),
    ...(row.corpus_generation_id !== null
      ? { corpusGenerationId: `corpus_generation_${row.corpus_generation_id}` }
      : {}),
    ...(isRecord(row.metadata) ? { metadata: row.metadata } : {}),
    ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
    createdAt: row.created_at.toISOString(),
  }
}

export class PostgresKnowledgeChunkRepository implements IKnowledgeChunkRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateKnowledgeChunkParams): Promise<KnowledgeChunk> {
    const sourceUuid = stripPrefix('knowledge_source_', params.sourceId)
    const visibleToAvatarIds = normalizeVisibleToAvatarIds(params.visibleToAvatarIds)
    validateEmbeddingIdentity(params)

    const embeddingExpression =
      params.embedding === undefined
        ? this.sql`NULL`
        : this.sql`${JSON.stringify(params.embedding)}::vector`
    const profileUuid =
      params.embeddingProfileId === undefined
        ? null
        : extractUuid('embedding_profile_', params.embeddingProfileId)
    const generationUuid =
      params.corpusGenerationId === undefined
        ? null
        : extractUuid('corpus_generation_', params.corpusGenerationId)
    if (params.embedding !== undefined && (profileUuid === null || generationUuid === null)) {
      throw new Error('Embedding profile and corpus generation ids must be valid UUIDs.')
    }

    const [row] = await this.sql<[KnowledgeChunkDbRow?]>`
      INSERT INTO knowledge_chunks (
        source_id,
        content,
        chunk_index,
        embedding,
        embedding_profile_id,
        corpus_generation_id,
        metadata,
        visible_to_avatar_ids
      )
      VALUES (
        ${sourceUuid},
        ${params.content},
        ${params.chunkIndex},
        ${embeddingExpression},
        ${profileUuid},
        ${generationUuid},
        ${this.sql.json((params.metadata ?? {}) as JSONValue)},
        ${visibleToAvatarIds ?? null}
      )
      RETURNING id, source_id, content, chunk_index, embedding::text, embedding_profile_id,
        corpus_generation_id, metadata, visible_to_avatar_ids, created_at
    `

    if (row === undefined) {
      throw new Error(`Knowledge chunk create failed for sourceId=${params.sourceId}.`)
    }

    return rowToKnowledgeChunk(normalizeEmbeddingRow(row))
  }

  async listBySourceId(sourceId: string): Promise<KnowledgeChunk[]> {
    const sourceUuid = extractUuid('knowledge_source_', sourceId)
    if (sourceUuid === null) return []

    const rows = await this.sql<KnowledgeChunkDbRow[]>`
      SELECT c.id, c.source_id, c.content, c.chunk_index, c.embedding::text,
        c.embedding_profile_id, c.corpus_generation_id, c.metadata, c.visible_to_avatar_ids, c.created_at
      FROM knowledge_chunks c
      CROSS JOIN knowledge_corpus_state state
      WHERE c.source_id = ${sourceUuid}
        AND (
          (state.active_generation_id IS NULL AND c.corpus_generation_id IS NULL)
          OR (
            c.corpus_generation_id = state.active_generation_id
            AND c.embedding_profile_id = state.active_profile_id
          )
        )
      ORDER BY chunk_index ASC
    `

    return rows.map((row) => rowToKnowledgeChunk(normalizeEmbeddingRow(row)))
  }

  async listBySourceIds(sourceIds: string[]): Promise<KnowledgeChunk[]> {
    const uuids = sourceIds
      .map((sourceId) => extractUuid('knowledge_source_', sourceId))
      .filter((sourceId): sourceId is string => sourceId !== null)
    if (uuids.length === 0) return []

    const rows = await this.sql<KnowledgeChunkDbRow[]>`
      SELECT c.id, c.source_id, c.content, c.chunk_index, c.embedding::text,
        c.embedding_profile_id, c.corpus_generation_id, c.metadata, c.visible_to_avatar_ids, c.created_at
      FROM knowledge_chunks c
      CROSS JOIN knowledge_corpus_state state
      WHERE c.source_id IN ${this.sql(uuids)}
        AND (
          (state.active_generation_id IS NULL AND c.corpus_generation_id IS NULL)
          OR (
            c.corpus_generation_id = state.active_generation_id
            AND c.embedding_profile_id = state.active_profile_id
          )
        )
      ORDER BY c.source_id ASC, c.chunk_index ASC
    `

    return rows.map((row) => rowToKnowledgeChunk(normalizeEmbeddingRow(row)))
  }

  async searchByVector(request: VectorSearchRequest): Promise<VectorSearchResult> {
    validateVectorSearchRequest(request)

    const scenarioUuid = requireUuid('scenario_', request.scenarioId)
    const profileUuid = requireUuid('embedding_profile_', request.embeddingProfileId)
    const generationUuid = requireUuid('corpus_generation_', request.corpusGenerationId)
    await assertActiveCorpus(this.sql, profileUuid, generationUuid, request.profile)
    const sourceUuids = getSourceUuids(request)
    if (sourceUuids !== undefined && sourceUuids.length === 0) return []

    const queryVector = this.sql`${JSON.stringify(request.queryVector)}::vector`
    const sourceFilter = buildSourceFilter(this.sql, sourceUuids)
    const visibilityFilter = buildVisibilityFilter(this.sql, request)
    const memoryScopeFilter = buildMemoryScopeFilter(this.sql, request)

    let rows: VectorSearchRow[]
    try {
      rows = await this.sql<VectorSearchRow[]>`
        SELECT c.id, c.source_id, c.content, c.chunk_index, s.knowledge_type,
          c.embedding <=> ${queryVector} AS distance,
          c.metadata, c.visible_to_avatar_ids
        FROM knowledge_chunks c
        JOIN knowledge_sources s ON s.id = c.source_id
        CROSS JOIN knowledge_corpus_state state
        WHERE s.scenario_id = ${scenarioUuid}
          AND s.status = 'ready'
          AND s.knowledge_type = ${request.knowledgeType}
          AND c.embedding IS NOT NULL
          AND c.embedding_profile_id = ${profileUuid}
          AND c.corpus_generation_id = ${generationUuid}
          AND state.active_profile_id = ${profileUuid}
          AND state.active_generation_id = ${generationUuid}
          ${sourceFilter}
          ${memoryScopeFilter}
          ${visibilityFilter}
        ORDER BY c.embedding <=> ${queryVector}, c.source_id ASC, c.chunk_index ASC, c.id ASC
        LIMIT ${request.candidateLimit}
      `
    } catch {
      throw new KnowledgeVectorSearchError({ code: 'vector_search_failed', retryable: false })
    }

    return rows.map((row) => vectorSearchRowToCandidate(row, request))
  }

  async deleteBySourceId(sourceId: string): Promise<number> {
    const sourceUuid = extractUuid('knowledge_source_', sourceId)
    if (sourceUuid === null) return 0

    const rows = await this.sql<Array<{ id: string }>>`
      DELETE FROM knowledge_chunks
      WHERE source_id = ${sourceUuid}
      RETURNING id
    `

    return rows.length
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

function requireUuid(prefix: string, id: string): string {
  const uuid = extractUuid(prefix, id)
  if (uuid === null) {
    throw new KnowledgeVectorSearchError({ code: 'vector_search_failed', retryable: false })
  }
  return uuid
}

function getSourceUuids(request: VectorSearchRequest): string[] | undefined {
  if (request.eligibleSourceIds === undefined) return undefined
  const sourceUuids = request.eligibleSourceIds.map((sourceId) =>
    extractUuid('knowledge_source_', sourceId),
  )
  if (sourceUuids.some((sourceId) => sourceId === null)) return []
  return sourceUuids.filter((sourceId): sourceId is string => sourceId !== null)
}

async function assertActiveCorpus(
  sql: Sql,
  profileUuid: string,
  generationUuid: string,
  profile: VectorSearchRequest['profile'],
): Promise<void> {
  let state:
    | {
        active_profile_id: string | null
        active_generation_id: string | null
        provider: string | null
        model: string | null
        dimensions: number | null
      }
    | undefined
  try {
    const states = await sql<
      {
        active_profile_id: string | null
        active_generation_id: string | null
        provider: string | null
        model: string | null
        dimensions: number | null
      }[]
    >`
      SELECT state.active_profile_id, state.active_generation_id,
        profile.provider, profile.model, profile.dimensions
      FROM knowledge_corpus_state AS state
      LEFT JOIN embedding_profiles profile ON profile.id = state.active_profile_id
    `
    state = states[0]
  } catch {
    throw new KnowledgeVectorSearchError({ code: 'vector_search_failed', retryable: false })
  }
  if (
    state?.active_profile_id !== profileUuid ||
    state.active_generation_id !== generationUuid ||
    state.provider !== profile.provider ||
    state.model !== profile.model ||
    state.dimensions !== profile.dimensions
  ) {
    throw new KnowledgeVectorSearchError({ code: 'incompatible_profile', retryable: false })
  }
}

function buildSourceFilter(sql: Sql, sourceUuids: string[] | undefined): SqlFragment {
  return sourceUuids === undefined
    ? sql``
    : sql`AND c.source_id = ANY(${sql.array(sourceUuids)}::uuid[])`
}

function buildVisibilityFilter(sql: Sql, request: VectorSearchRequest): SqlFragment {
  if (request.visibilityMode === 'gm_unrestricted') return sql``
  const activeAvatarId = request.activeAvatarId ?? null
  const effectiveAvatarIds = sql`
    COALESCE(
      NULLIF(c.visible_to_avatar_ids, '{}'::text[]),
      NULLIF(s.visible_to_avatar_ids, '{}'::text[])
    )
  `
  return sql`
    AND (
      s.visibility_policy = 'all'
      OR (
        s.visibility_policy = 'avatars'
        AND ${activeAvatarId}::text IS NOT NULL
        AND ${effectiveAvatarIds} @> ARRAY[${activeAvatarId}]::text[]
      )
      OR (
        s.visibility_policy IS NULL
        AND (
          ${effectiveAvatarIds} IS NULL
          OR (
            ${activeAvatarId}::text IS NOT NULL
            AND ${effectiveAvatarIds} @> ARRAY[${activeAvatarId}]::text[]
          )
        )
      )
    )
  `
}

function buildMemoryScopeFilter(sql: Sql, request: VectorSearchRequest): SqlFragment {
  if (request.knowledgeType !== 'memory') return sql``
  const userId = request.userId ?? null
  const sessionId = request.sessionId ?? null
  const conversationId = request.conversationId ?? null
  return sql`
    AND (${userId}::text IS NULL OR c.metadata->>'userId' IS NULL OR c.metadata->>'userId' = ${userId})
    AND (${sessionId}::text IS NULL OR c.metadata->>'sessionId' IS NULL OR c.metadata->>'sessionId' = ${sessionId})
    AND (${conversationId}::text IS NULL OR c.metadata->>'conversationId' IS NULL OR c.metadata->>'conversationId' = ${conversationId})
  `
}

function vectorSearchRowToCandidate(
  row: VectorSearchRow,
  request: VectorSearchRequest,
): VectorRetrievalCandidate {
  const distance = typeof row.distance === 'number' ? row.distance : Number(row.distance)
  if (!Number.isFinite(distance)) {
    throw new KnowledgeVectorSearchError({ code: 'vector_search_failed', retryable: false })
  }
  const metadata = normalizeMetadata(row.metadata)
  const visibleToAvatarIds = normalizeVisibleToAvatarIds(row.visible_to_avatar_ids)
  return {
    sourceId: `knowledge_source_${row.source_id}`,
    chunkId: `knowledge_chunk_${row.id}`,
    knowledgeType: row.knowledge_type,
    content: row.content,
    chunkIndex: row.chunk_index,
    distance,
    similarity: 1 - distance,
    matchedQuery: request.queryVariant,
    ...(request.queryIndex !== undefined ? { queryIndex: request.queryIndex } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
  }
}

function validateEmbeddingIdentity(params: CreateKnowledgeChunkParams): void {
  const hasEmbedding = params.embedding !== undefined
  const hasIdentity =
    params.embeddingProfileId !== undefined || params.corpusGenerationId !== undefined
  if (hasEmbedding && (!params.embeddingProfileId || !params.corpusGenerationId)) {
    throw new Error(
      'Vectorized knowledge chunks require an embedding profile and corpus generation.',
    )
  }
  if (!hasEmbedding && hasIdentity) {
    throw new Error('Embedding profile and corpus generation require a vectorized chunk.')
  }
}

function normalizeEmbeddingRow(row: KnowledgeChunkDbRow): KnowledgeChunkRow {
  return {
    ...row,
    embedding: parseVectorText(row.embedding),
  }
}

function parseVectorText(value: unknown): number[] | null {
  if (value === null) return null
  if (Array.isArray(value))
    return value.filter((entry): entry is number => typeof entry === 'number')
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null
  const content = trimmed.slice(1, -1).trim()
  if (content.length === 0) return []

  const parsed = content
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry))

  return parsed
}
