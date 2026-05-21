import type { JSONValue, Sql } from 'postgres'
import type {
  CreateKnowledgeChunkParams,
  IKnowledgeChunkRepository,
} from '../../../application/ports/IKnowledgeChunkRepository.js'
import type { KnowledgeChunk } from '../../../domain/knowledge/knowledge.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

type KnowledgeChunkDbRow = {
  id: string
  source_id: string
  content: string
  chunk_index: number
  embedding: unknown
  metadata: unknown
  visible_to_avatar_ids: string[] | null
  created_at: Date
}

type KnowledgeChunkRow = Omit<KnowledgeChunkDbRow, 'embedding'> & { embedding: number[] | null }

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

function rowToKnowledgeChunk(row: KnowledgeChunkRow): KnowledgeChunk {
  const visibleToAvatarIds = normalizeVisibleToAvatarIds(row.visible_to_avatar_ids)
  return {
    chunkId: `knowledge_chunk_${row.id}`,
    sourceId: `knowledge_source_${row.source_id}`,
    content: row.content,
    chunkIndex: row.chunk_index,
    ...(row.embedding !== null ? { embedding: [...row.embedding] } : {}),
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

    const embeddingExpression =
      params.embedding === undefined
        ? this.sql`NULL`
        : this.sql`${JSON.stringify(params.embedding)}::vector`

    const [row] = await this.sql<[KnowledgeChunkDbRow?]>`
      INSERT INTO knowledge_chunks (source_id, content, chunk_index, embedding, metadata, visible_to_avatar_ids)
      VALUES (
        ${sourceUuid},
        ${params.content},
        ${params.chunkIndex},
        ${embeddingExpression},
        ${this.sql.json((params.metadata ?? {}) as JSONValue)},
        ${visibleToAvatarIds ?? null}
      )
      RETURNING id, source_id, content, chunk_index, embedding::text, metadata, visible_to_avatar_ids, created_at
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
      SELECT id, source_id, content, chunk_index, embedding::text, metadata, visible_to_avatar_ids, created_at
      FROM knowledge_chunks
      WHERE source_id = ${sourceUuid}
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
      SELECT id, source_id, content, chunk_index, embedding::text, metadata, visible_to_avatar_ids, created_at
      FROM knowledge_chunks
      WHERE source_id IN ${this.sql(uuids)}
      ORDER BY source_id ASC, chunk_index ASC
    `

    return rows.map((row) => rowToKnowledgeChunk(normalizeEmbeddingRow(row)))
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
