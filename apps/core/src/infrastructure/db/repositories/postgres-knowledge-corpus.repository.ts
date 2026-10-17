import type { Sql } from 'postgres'
import type { EmbeddingProfile } from '../../../application/ports/IEmbeddingAdapter.js'
import type {
  ActiveCorpus,
  ActiveSourceChunkReplacement,
  CorpusValidation,
  CreateReindexOperationParams,
  IKnowledgeCorpusRepository,
  PersistedEmbeddingProfile,
  ReindexOperation,
  ReindexSourceProgress,
  StagedKnowledgeChunk,
  UpdateReindexOperationParams,
  UpdateReindexSourceProgressParams,
} from '../../../application/ports/IKnowledgeCorpusRepository.js'
import type { KnowledgeChunk } from '../../../domain/knowledge/knowledge.types.js'
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../../config.js'
import { extractUuid } from './id-prefix.js'
import { promoteCorpusGeneration, validateCorpusGeneration } from './postgres-corpus-generation.js'
import {
  refreshCompletedSourceCount,
  replaceActiveSourceChunks,
  replaceStagedSourceChunks,
} from './postgres-knowledge-chunk-writes.js'
import {
  type ReindexOperationRow,
  type ReindexSourceProgressRow,
  type ChunkRow,
  requireUuid,
  rowToOperation,
  rowToSourceProgress,
  rowToKnowledgeChunk,
  boundFailureDetails,
} from './postgres-knowledge-corpus.mapping.js'

export class PostgresKnowledgeCorpusRepository implements IKnowledgeCorpusRepository {
  constructor(private readonly sql: Sql) {}

  async createEmbeddingProfile(profile: EmbeddingProfile): Promise<PersistedEmbeddingProfile> {
    if (profile.dimensions !== DEFAULT_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding profile dimensions must match VECTOR(${String(DEFAULT_EMBEDDING_DIMENSIONS)}).`,
      )
    }
    const [row] = await this.sql<
      {
        id: string
        provider: string
        model: string
        dimensions: number
        created_at: Date
      }[]
    >`
      INSERT INTO embedding_profiles (provider, model, dimensions)
      VALUES (${profile.provider}, ${profile.model}, ${profile.dimensions})
      ON CONFLICT (provider, model, dimensions) DO UPDATE SET provider = EXCLUDED.provider
      RETURNING id, provider, model, dimensions, created_at
    `
    if (row === undefined) throw new Error('Embedding profile persistence failed.')
    return {
      embeddingProfileId: `embedding_profile_${row.id}`,
      provider: row.provider,
      model: row.model,
      dimensions: row.dimensions,
      createdAt: row.created_at.toISOString(),
    }
  }

  async findEmbeddingProfile(
    embeddingProfileId: string,
  ): Promise<PersistedEmbeddingProfile | null> {
    const uuid = extractUuid('embedding_profile_', embeddingProfileId)
    if (uuid === null) return null
    const [row] = await this.sql<
      { id: string; provider: string; model: string; dimensions: number; created_at: Date }[]
    >`
      SELECT id, provider, model, dimensions, created_at
      FROM embedding_profiles
      WHERE id = ${uuid}
    `
    if (row === undefined) return null
    return {
      embeddingProfileId: `embedding_profile_${row.id}`,
      provider: row.provider,
      model: row.model,
      dimensions: row.dimensions,
      createdAt: row.created_at.toISOString(),
    }
  }

  async createReindexOperation(params: CreateReindexOperationParams): Promise<ReindexOperation> {
    const profileUuid = requireUuid('embedding_profile_', params.embeddingProfileId)
    const operationUuid = params.reindexOperationId
      ? requireUuid('reindex_operation_', params.reindexOperationId)
      : crypto.randomUUID()
    const generationUuid = params.corpusGenerationId
      ? requireUuid('corpus_generation_', params.corpusGenerationId)
      : crypto.randomUUID()
    const sourceUuids = [...new Set(params.sourceIds)].map((sourceId) =>
      requireUuid('knowledge_source_', sourceId),
    )
    const now = new Date().toISOString()

    return this.sql.begin(async (tx) => {
      const [activeState] = await tx<
        { active_generation_id: string | null; active_profile_id: string | null }[]
      >`
        SELECT active_generation_id, active_profile_id
        FROM knowledge_corpus_state
        WHERE id = 1
        FOR UPDATE
      `
      if (activeState === undefined) throw new Error('Active corpus state is unavailable.')
      const [existing] = await tx<ReindexOperationRow[]>`
        SELECT id, corpus_generation_id, embedding_profile_id,
          expected_active_generation_id, expected_active_profile_id, status, attempts,
          expected_source_count, completed_source_count, created_at, started_at,
          completed_at, failure_details
        FROM reindex_operations
        WHERE id = ${operationUuid}
      `
      if (existing !== undefined) return rowToOperation(existing)

      const candidates = await tx<ReindexOperationRow[]>`
        SELECT id, corpus_generation_id, embedding_profile_id,
          expected_active_generation_id, expected_active_profile_id, status, attempts,
          expected_source_count, completed_source_count, created_at, started_at,
          completed_at, failure_details
        FROM reindex_operations
        WHERE embedding_profile_id = ${profileUuid}
          AND status IN ('pending', 'running', 'failed')
          AND expected_active_generation_id IS NOT DISTINCT FROM ${activeState.active_generation_id}
          AND expected_active_profile_id IS NOT DISTINCT FROM ${activeState.active_profile_id}
        ORDER BY created_at ASC
      `
      for (const candidate of candidates) {
        const candidateSources = await tx<{ source_id: string }[]>`
          SELECT source_id FROM reindex_operation_sources
          WHERE reindex_operation_id = ${candidate.id}
        `
        if (
          candidateSources.length === sourceUuids.length &&
          candidateSources.every((source) => sourceUuids.includes(source.source_id))
        ) {
          return rowToOperation(candidate)
        }
      }

      await tx`
        INSERT INTO corpus_generations (
          id, embedding_profile_id, status, expected_source_count
        )
        VALUES (
          ${generationUuid}, ${profileUuid}, 'staging', ${sourceUuids.length}
        )
      `
      await tx`
        INSERT INTO reindex_operations (
          id, corpus_generation_id, embedding_profile_id,
          expected_active_generation_id, expected_active_profile_id, expected_source_count
        )
        VALUES (
          ${operationUuid}, ${generationUuid}, ${profileUuid},
          ${activeState.active_generation_id}, ${activeState.active_profile_id},
          ${sourceUuids.length}
        )
      `
      for (const sourceUuid of sourceUuids) {
        await tx`
          INSERT INTO corpus_generation_sources (corpus_generation_id, source_id)
          VALUES (${generationUuid}, ${sourceUuid})
          ON CONFLICT (corpus_generation_id, source_id) DO NOTHING
        `
        await tx`
          INSERT INTO reindex_operation_sources (reindex_operation_id, source_id)
          VALUES (${operationUuid}, ${sourceUuid})
          ON CONFLICT (reindex_operation_id, source_id) DO NOTHING
        `
      }
      const [row] = await tx<ReindexOperationRow[]>`
        SELECT id, corpus_generation_id, embedding_profile_id,
          expected_active_generation_id, expected_active_profile_id, status, attempts,
          expected_source_count, completed_source_count, created_at, started_at,
          completed_at, failure_details
        FROM reindex_operations
        WHERE id = ${operationUuid}
      `
      if (row === undefined) throw new Error(`Reindex operation creation failed at ${now}.`)
      return rowToOperation(row)
    })
  }

  async findReindexOperation(reindexOperationId: string): Promise<ReindexOperation | null> {
    const uuid = extractUuid('reindex_operation_', reindexOperationId)
    if (uuid === null) return null
    const [row] = await this.sql<ReindexOperationRow[]>`
      SELECT id, corpus_generation_id, embedding_profile_id,
        expected_active_generation_id, expected_active_profile_id, status, attempts,
        expected_source_count, completed_source_count, created_at, started_at,
        completed_at, failure_details
      FROM reindex_operations
      WHERE id = ${uuid}
    `
    return row === undefined ? null : rowToOperation(row)
  }

  async claimReindexOperation(reindexOperationId: string): Promise<ReindexOperation | null> {
    const uuid = extractUuid('reindex_operation_', reindexOperationId)
    if (uuid === null) return null
    const [row] = await this.sql<ReindexOperationRow[]>`
      UPDATE reindex_operations
      SET status = 'running', attempts = attempts + 1, started_at = NOW(), updated_at = NOW()
      WHERE id = ${uuid} AND status IN ('pending', 'failed')
      RETURNING id, corpus_generation_id, embedding_profile_id,
        expected_active_generation_id, expected_active_profile_id, status, attempts,
        expected_source_count, completed_source_count, created_at, started_at,
        completed_at, failure_details
    `
    return row === undefined ? null : rowToOperation(row)
  }

  async recoverRunningReindexOperations(): Promise<string[]> {
    return this.sql.begin(async (tx) => {
      const rows = await tx<{ id: string }[]>`
        UPDATE reindex_operations
        SET status = 'failed', completed_at = NOW(),
          failure_details = 'worker_interrupted: Reindex worker was interrupted.', updated_at = NOW()
        WHERE status = 'running'
        RETURNING id
      `
      if (rows.length === 0) return []
      await tx`
        UPDATE reindex_operation_sources
        SET status = 'failed', completed_at = NOW(),
          failure_details = 'worker_interrupted: Reindex worker was interrupted.', updated_at = NOW()
        WHERE status = 'running'
          AND reindex_operation_id = ANY(${tx.array(rows.map((row) => row.id))}::uuid[])
      `
      return rows.map((row) => `reindex_operation_${row.id}`)
    })
  }

  async updateReindexOperation(
    reindexOperationId: string,
    updates: UpdateReindexOperationParams,
  ): Promise<ReindexOperation | null> {
    const uuid = extractUuid('reindex_operation_', reindexOperationId)
    if (uuid === null) return null
    const [row] = await this.sql<ReindexOperationRow[]>`
      UPDATE reindex_operations
      SET status = ${updates.status},
        attempts = COALESCE(${orNull(updates.attempts)}, attempts),
        started_at = COALESCE(${orNull(updates.startedAt)}::timestamptz, started_at),
        completed_at = COALESCE(${orNull(updates.completedAt)}::timestamptz, completed_at),
        failure_details = COALESCE(
          ${updates.failureDetails === undefined ? null : boundFailureDetails(updates.failureDetails)},
          failure_details
        ),
        updated_at = NOW()
      WHERE id = ${uuid}
      RETURNING id, corpus_generation_id, embedding_profile_id,
        expected_active_generation_id, expected_active_profile_id, status, attempts,
        expected_source_count, completed_source_count, created_at, started_at,
        completed_at, failure_details
    `
    return row === undefined ? null : rowToOperation(row)
  }

  async listReindexSourceProgress(reindexOperationId: string): Promise<ReindexSourceProgress[]> {
    const uuid = extractUuid('reindex_operation_', reindexOperationId)
    if (uuid === null) return []
    const rows = await this.sql<ReindexSourceProgressRow[]>`
      SELECT reindex_operation_id, source_id, status, attempts, expected_chunk_count,
        completed_chunk_count, embedded_chunk_count, reused_chunk_count,
        started_at, completed_at, failure_details
      FROM reindex_operation_sources
      WHERE reindex_operation_id = ${uuid}
      ORDER BY source_id ASC
    `
    return rows.map(rowToSourceProgress)
  }

  async updateReindexSourceProgress(
    reindexOperationId: string,
    sourceId: string,
    updates: UpdateReindexSourceProgressParams,
  ): Promise<ReindexSourceProgress | null> {
    const operationUuid = extractUuid('reindex_operation_', reindexOperationId)
    const sourceUuid = extractUuid('knowledge_source_', sourceId)
    if (operationUuid === null || sourceUuid === null) return null
    return this.sql.begin(async (tx) => {
      const [row] = await tx<ReindexSourceProgressRow[]>`
        UPDATE reindex_operation_sources
        SET status = ${updates.status},
          attempts = COALESCE(${orNull(updates.attempts)}, attempts),
          expected_chunk_count = COALESCE(${orNull(updates.expectedChunkCount)}, expected_chunk_count),
          completed_chunk_count = COALESCE(${orNull(updates.completedChunkCount)}, completed_chunk_count),
          embedded_chunk_count = COALESCE(${orNull(updates.embeddedChunkCount)}, embedded_chunk_count),
          reused_chunk_count = COALESCE(${orNull(updates.reusedChunkCount)}, reused_chunk_count),
          started_at = COALESCE(${orNull(updates.startedAt)}::timestamptz, started_at),
          completed_at = COALESCE(${orNull(updates.completedAt)}::timestamptz, completed_at),
          failure_details = COALESCE(
            ${orNull(updates.failureDetails, boundFailureDetails)},
            failure_details
          ),
          updated_at = NOW()
        WHERE reindex_operation_id = ${operationUuid} AND source_id = ${sourceUuid}
        RETURNING reindex_operation_id, source_id, status, attempts, expected_chunk_count,
          completed_chunk_count, embedded_chunk_count, reused_chunk_count,
          started_at, completed_at, failure_details
      `
      if (row === undefined) return null
      await tx`
        UPDATE corpus_generation_sources
        SET status = ${updates.status},
          expected_chunk_count = COALESCE(${orNull(updates.expectedChunkCount)}, expected_chunk_count),
          completed_chunk_count = COALESCE(${orNull(updates.completedChunkCount)}, completed_chunk_count),
          updated_at = NOW()
        WHERE corpus_generation_id = (
          SELECT corpus_generation_id FROM reindex_operations WHERE id = ${operationUuid}
        ) AND source_id = ${sourceUuid}
      `
      await refreshCompletedSourceCount(tx, operationUuid)
      return rowToSourceProgress(row)
    })
  }

  replaceStagedSourceChunks(
    reindexOperationId: string,
    sourceId: string,
    chunks: readonly StagedKnowledgeChunk[],
  ): Promise<number> {
    return replaceStagedSourceChunks(this.sql, reindexOperationId, sourceId, chunks)
  }

  replaceActiveSourceChunks(replacement: ActiveSourceChunkReplacement): Promise<number> {
    return replaceActiveSourceChunks(this.sql, replacement)
  }

  validateCorpusGeneration(reindexOperationId: string): Promise<CorpusValidation> {
    return validateCorpusGeneration(this.sql, reindexOperationId)
  }

  promoteCorpusGeneration(reindexOperationId: string): Promise<ActiveCorpus> {
    return promoteCorpusGeneration(this.sql, reindexOperationId)
  }

  async getActiveCorpus(): Promise<ActiveCorpus | null> {
    const [row] = await this.sql<
      {
        generation_id: string | null
        profile_id: string | null
        provider: string | null
        model: string | null
        dimensions: number | null
      }[]
    >`
      SELECT state.active_generation_id AS generation_id, state.active_profile_id AS profile_id,
        profile.provider, profile.model, profile.dimensions
      FROM knowledge_corpus_state state
      LEFT JOIN embedding_profiles profile ON profile.id = state.active_profile_id
      WHERE state.id = 1
    `
    if (
      row === undefined ||
      row.generation_id === null ||
      row.profile_id === null ||
      row.provider === null ||
      row.model === null ||
      row.dimensions === null
    ) {
      return null
    }
    return {
      corpusGenerationId: `corpus_generation_${row.generation_id}`,
      embeddingProfileId: `embedding_profile_${row.profile_id}`,
      profile: { provider: row.provider, model: row.model, dimensions: row.dimensions },
    }
  }

  async listActiveChunksBySourceIds(sourceIds: readonly string[]): Promise<KnowledgeChunk[]> {
    const uuids = sourceIds
      .map((sourceId) => extractUuid('knowledge_source_', sourceId))
      .filter((sourceId): sourceId is string => sourceId !== null)
    if (uuids.length === 0) return []
    const rows = await this.sql<ChunkRow[]>`
      SELECT c.id, c.source_id, c.content, c.content_hash, c.chunk_index, c.embedding::text,
        c.embedding_profile_id, c.corpus_generation_id, c.metadata,
        c.visible_to_avatar_ids, c.created_at
      FROM knowledge_chunks c
      CROSS JOIN knowledge_corpus_state state
      WHERE c.source_id IN ${this.sql(uuids)}
        AND c.corpus_generation_id = state.active_generation_id
        AND c.embedding_profile_id = state.active_profile_id
      ORDER BY c.source_id ASC, c.chunk_index ASC
    `
    return rows.map(rowToKnowledgeChunk)
  }
}

function orNull<T, R = T>(value: T | undefined, map?: (value: T) => R): R | T | null {
  if (value === undefined) return null
  return map === undefined ? value : map(value)
}
