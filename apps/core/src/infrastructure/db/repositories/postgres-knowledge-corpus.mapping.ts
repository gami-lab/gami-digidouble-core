import { MAX_REINDEX_FAILURE_DETAILS_LENGTH } from '../../../application/ports/IKnowledgeCorpusRepository.js'
import type {
  ReindexOperation,
  ReindexSourceProgress,
} from '../../../application/ports/IKnowledgeCorpusRepository.js'
import type { KnowledgeChunk } from '../../../domain/knowledge/knowledge.types.js'
import { optionalField } from '../../../domain/optional-field.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

export type ReindexOperationRow = {
  id: string
  corpus_generation_id: string
  embedding_profile_id: string
  expected_active_generation_id: string | null
  expected_active_profile_id: string | null
  status: ReindexOperation['status']
  attempts: number
  expected_source_count: number
  completed_source_count: number
  created_at: Date
  started_at: Date | null
  completed_at: Date | null
  failure_details: string | null
}

export type ReindexSourceProgressRow = {
  reindex_operation_id: string
  source_id: string
  status: ReindexSourceProgress['status']
  attempts: number
  expected_chunk_count: number | null
  completed_chunk_count: number
  embedded_chunk_count: number
  reused_chunk_count: number
  started_at: Date | null
  completed_at: Date | null
  failure_details: string | null
}

export type ChunkRow = {
  id: string
  source_id: string
  content: string
  content_hash: string | null
  chunk_index: number
  embedding: string | null
  embedding_profile_id: string | null
  corpus_generation_id: string | null
  metadata: unknown
  visible_to_avatar_ids: string[] | null
  created_at: Date
}

export function requireUuid(prefix: string, value: string): string {
  const uuid = stripPrefix(prefix, value)
  if (uuid.length === 0 || extractUuid(prefix, value) === null) {
    throw new Error(`Invalid ${prefix} identifier.`)
  }
  return uuid
}

export function rowToOperation(row: ReindexOperationRow): ReindexOperation {
  return {
    reindexOperationId: `reindex_operation_${row.id}`,
    corpusGenerationId: `corpus_generation_${row.corpus_generation_id}`,
    embeddingProfileId: `embedding_profile_${row.embedding_profile_id}`,
    ...(row.expected_active_profile_id !== null
      ? { expectedActiveProfileId: `embedding_profile_${row.expected_active_profile_id}` }
      : {}),
    ...(row.expected_active_generation_id !== null
      ? { expectedActiveGenerationId: `corpus_generation_${row.expected_active_generation_id}` }
      : {}),
    status: row.status,
    attempts: row.attempts,
    expectedSourceCount: row.expected_source_count,
    completedSourceCount: row.completed_source_count,
    createdAt: row.created_at.toISOString(),
    ...(row.started_at !== null ? { startedAt: row.started_at.toISOString() } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at.toISOString() } : {}),
    ...(row.failure_details !== null ? { failureDetails: row.failure_details } : {}),
  }
}

export function rowToSourceProgress(row: ReindexSourceProgressRow): ReindexSourceProgress {
  return {
    reindexOperationId: `reindex_operation_${row.reindex_operation_id}`,
    sourceId: `knowledge_source_${row.source_id}`,
    status: row.status,
    attempts: row.attempts,
    ...(row.expected_chunk_count !== null ? { expectedChunkCount: row.expected_chunk_count } : {}),
    completedChunkCount: row.completed_chunk_count,
    embeddedChunkCount: row.embedded_chunk_count,
    reusedChunkCount: row.reused_chunk_count,
    ...(row.started_at !== null ? { startedAt: row.started_at.toISOString() } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at.toISOString() } : {}),
    ...(row.failure_details !== null ? { failureDetails: row.failure_details } : {}),
  }
}

export function rowToKnowledgeChunk(row: ChunkRow): KnowledgeChunk {
  return {
    chunkId: `knowledge_chunk_${row.id}`,
    sourceId: `knowledge_source_${row.source_id}`,
    content: row.content,
    ...optionalField('contentHash', row.content_hash),
    chunkIndex: row.chunk_index,
    ...optionalField('embedding', row.embedding, parseVectorText),
    ...optionalField(
      'embeddingProfileId',
      row.embedding_profile_id,
      (id) => `embedding_profile_${id}`,
    ),
    ...optionalField(
      'corpusGenerationId',
      row.corpus_generation_id,
      (id) => `corpus_generation_${id}`,
    ),
    ...optionalField('metadata', readMetadataRecord(row.metadata)),
    ...optionalField('visibleToAvatarIds', nonEmpty(row.visible_to_avatar_ids)),
    createdAt: row.created_at.toISOString(),
  }
}

function readMetadataRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function nonEmpty<T>(values: T[] | null): T[] | undefined {
  return values !== null && values.length > 0 ? values : undefined
}

function parseVectorText(value: string): number[] {
  const content = value.trim().replace(/^\[/, '').replace(/\]$/, '').trim()
  if (content.length === 0) return []
  return content.split(',').map((entry) => Number(entry.trim()))
}

export function boundFailureDetails(value: string): string {
  return value.slice(0, MAX_REINDEX_FAILURE_DETAILS_LENGTH)
}
