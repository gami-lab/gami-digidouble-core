/* eslint-disable max-lines */

import type { JSONValue, Sql } from 'postgres'
import type { EmbeddingProfile } from '../../../application/ports/IEmbeddingAdapter.js'
import { MAX_REINDEX_FAILURE_DETAILS_LENGTH } from '../../../application/ports/IKnowledgeCorpusRepository.js'
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
import { extractUuid, stripPrefix } from './id-prefix.js'

type ReindexOperationRow = {
  id: string
  corpus_generation_id: string
  embedding_profile_id: string
  status: ReindexOperation['status']
  attempts: number
  expected_source_count: number
  completed_source_count: number
  created_at: Date
  started_at: Date | null
  completed_at: Date | null
  failure_details: string | null
}

type ReindexSourceProgressRow = {
  reindex_operation_id: string
  source_id: string
  status: ReindexSourceProgress['status']
  attempts: number
  expected_chunk_count: number | null
  completed_chunk_count: number
  started_at: Date | null
  completed_at: Date | null
  failure_details: string | null
}

type ChunkRow = {
  id: string
  source_id: string
  content: string
  chunk_index: number
  embedding: string | null
  embedding_profile_id: string | null
  corpus_generation_id: string | null
  metadata: unknown
  visible_to_avatar_ids: string[] | null
  created_at: Date
}

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
      const [existing] = await tx<ReindexOperationRow[]>`
        SELECT id, corpus_generation_id, embedding_profile_id, status, attempts,
          expected_source_count, completed_source_count, created_at, started_at,
          completed_at, failure_details
        FROM reindex_operations
        WHERE id = ${operationUuid}
      `
      if (existing !== undefined) return rowToOperation(existing)

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
          id, corpus_generation_id, embedding_profile_id, expected_source_count
        )
        VALUES (
          ${operationUuid}, ${generationUuid}, ${profileUuid}, ${sourceUuids.length}
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
        SELECT id, corpus_generation_id, embedding_profile_id, status, attempts,
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
      SELECT id, corpus_generation_id, embedding_profile_id, status, attempts,
        expected_source_count, completed_source_count, created_at, started_at,
        completed_at, failure_details
      FROM reindex_operations
      WHERE id = ${uuid}
    `
    return row === undefined ? null : rowToOperation(row)
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
        attempts = COALESCE(${updates.attempts ?? null}, attempts),
        started_at = COALESCE(${updates.startedAt ?? null}::timestamptz, started_at),
        completed_at = COALESCE(${updates.completedAt ?? null}::timestamptz, completed_at),
        failure_details = COALESCE(
          ${updates.failureDetails === undefined ? null : boundFailureDetails(updates.failureDetails)},
          failure_details
        ),
        updated_at = NOW()
      WHERE id = ${uuid}
      RETURNING id, corpus_generation_id, embedding_profile_id, status, attempts,
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
        completed_chunk_count, started_at, completed_at, failure_details
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
          attempts = COALESCE(${updates.attempts ?? null}, attempts),
          expected_chunk_count = COALESCE(${updates.expectedChunkCount ?? null}, expected_chunk_count),
          completed_chunk_count = COALESCE(${updates.completedChunkCount ?? null}, completed_chunk_count),
          started_at = COALESCE(${updates.startedAt ?? null}::timestamptz, started_at),
          completed_at = COALESCE(${updates.completedAt ?? null}::timestamptz, completed_at),
          failure_details = COALESCE(
            ${updates.failureDetails === undefined ? null : boundFailureDetails(updates.failureDetails)},
            failure_details
          ),
          updated_at = NOW()
        WHERE reindex_operation_id = ${operationUuid} AND source_id = ${sourceUuid}
        RETURNING reindex_operation_id, source_id, status, attempts, expected_chunk_count,
          completed_chunk_count, started_at, completed_at, failure_details
      `
      if (row === undefined) return null
      await tx`
        UPDATE corpus_generation_sources
        SET status = ${updates.status},
          expected_chunk_count = COALESCE(${updates.expectedChunkCount ?? null}, expected_chunk_count),
          completed_chunk_count = COALESCE(${updates.completedChunkCount ?? null}, completed_chunk_count),
          updated_at = NOW()
        WHERE corpus_generation_id = (
          SELECT corpus_generation_id FROM reindex_operations WHERE id = ${operationUuid}
        ) AND source_id = ${sourceUuid}
      `
      await tx`
        UPDATE reindex_operations
        SET completed_source_count = (
          SELECT COUNT(*) FROM reindex_operation_sources
          WHERE reindex_operation_id = ${operationUuid} AND status = 'completed'
        ), updated_at = NOW()
        WHERE id = ${operationUuid}
      `
      return rowToSourceProgress(row)
    })
  }

  async replaceStagedSourceChunks(
    reindexOperationId: string,
    sourceId: string,
    chunks: readonly StagedKnowledgeChunk[],
  ): Promise<number> {
    const operationUuid = requireUuid('reindex_operation_', reindexOperationId)
    const sourceUuid = requireUuid('knowledge_source_', sourceId)
    return this.sql.begin(async (tx) => {
      const [operation] = await tx<{ generation_id: string; profile_id: string }[]>`
        SELECT corpus_generation_id AS generation_id, embedding_profile_id AS profile_id
        FROM reindex_operations
        WHERE id = ${operationUuid}
      `
      if (operation === undefined) throw new Error('Reindex operation not found.')
      const [source] = await tx<{ source_id: string }[]>`
        SELECT source_id FROM reindex_operation_sources
        WHERE reindex_operation_id = ${operationUuid} AND source_id = ${sourceUuid}
      `
      if (source === undefined) throw new Error('Source is not part of reindex operation.')
      for (const chunk of chunks) {
        if (
          chunk.sourceId !== sourceId ||
          chunk.corpusGenerationId !== `corpus_generation_${operation.generation_id}` ||
          chunk.embeddingProfileId !== `embedding_profile_${operation.profile_id}`
        ) {
          throw new Error('Staged chunk identity does not match the reindex operation.')
        }
      }
      await tx`
        DELETE FROM knowledge_chunks
        WHERE source_id = ${sourceUuid} AND corpus_generation_id = ${operation.generation_id}
      `
      for (const chunk of chunks) {
        await tx`
          INSERT INTO knowledge_chunks (
            source_id, content, chunk_index, embedding, embedding_profile_id,
            corpus_generation_id, metadata, visible_to_avatar_ids
          ) VALUES (
            ${sourceUuid}, ${chunk.content}, ${chunk.chunkIndex},
            ${JSON.stringify(chunk.embedding)}::vector, ${operation.profile_id},
            ${operation.generation_id}, ${tx.json((chunk.metadata ?? {}) as JSONValue)},
            ${chunk.visibleToAvatarIds ?? null}
          )
        `
      }
      await tx`
        UPDATE reindex_operation_sources
        SET status = 'completed', expected_chunk_count = ${chunks.length},
          completed_chunk_count = ${chunks.length}, completed_at = NOW(), updated_at = NOW()
        WHERE reindex_operation_id = ${operationUuid} AND source_id = ${sourceUuid}
      `
      await tx`
        UPDATE corpus_generation_sources
        SET status = 'completed', expected_chunk_count = ${chunks.length},
          completed_chunk_count = ${chunks.length}, updated_at = NOW()
        WHERE corpus_generation_id = ${operation.generation_id} AND source_id = ${sourceUuid}
      `
      await tx`
        UPDATE reindex_operations
        SET completed_source_count = (
          SELECT COUNT(*) FROM reindex_operation_sources
          WHERE reindex_operation_id = ${operationUuid} AND status = 'completed'
        ), updated_at = NOW()
        WHERE id = ${operationUuid}
      `
      return chunks.length
    })
  }

  async replaceActiveSourceChunks(replacement: ActiveSourceChunkReplacement): Promise<number> {
    const sourceUuid = requireUuid('knowledge_source_', replacement.sourceId)
    const profileUuid = requireUuid('embedding_profile_', replacement.embeddingProfileId)
    const generationUuid = requireUuid('corpus_generation_', replacement.corpusGenerationId)
    if (replacement.chunks.length === 0) {
      throw new Error('At least one vectorized chunk is required.')
    }
    for (const chunk of replacement.chunks) {
      if (
        chunk.sourceId !== replacement.sourceId ||
        chunk.embeddingProfileId !== replacement.embeddingProfileId ||
        chunk.corpusGenerationId !== replacement.corpusGenerationId ||
        chunk.embedding.some((value) => !Number.isFinite(value))
      ) {
        throw new Error('Active source chunk identity or vector is invalid.')
      }
    }

    // eslint-disable-next-line complexity
    return this.sql.begin(async (tx) => {
      const [active] = await tx<
        {
          generation_id: string | null
          profile_id: string | null
          dimensions: number | null
        }[]
      >`
        SELECT state.active_generation_id AS generation_id,
          state.active_profile_id AS profile_id,
          profile.dimensions
        FROM knowledge_corpus_state state
        JOIN embedding_profiles profile ON profile.id = state.active_profile_id
        WHERE state.id = 1
        FOR UPDATE
      `
      if (
        active === undefined ||
        active.generation_id === null ||
        active.profile_id === null ||
        active.dimensions === null
      ) {
        throw new Error('No active knowledge corpus is configured.')
      }
      if (active.generation_id !== generationUuid || active.profile_id !== profileUuid) {
        throw new Error('Active embedding profile or corpus generation changed.')
      }
      if (replacement.chunks.some((chunk) => chunk.embedding.length !== active.dimensions)) {
        throw new Error('Active source chunk vector dimension does not match the active profile.')
      }

      await tx`
        DELETE FROM knowledge_chunks
        WHERE source_id = ${sourceUuid}
          AND corpus_generation_id = ${generationUuid}
          AND embedding_profile_id = ${profileUuid}
      `
      for (const chunk of replacement.chunks) {
        await tx`
          INSERT INTO knowledge_chunks (
            source_id, content, chunk_index, embedding, embedding_profile_id,
            corpus_generation_id, metadata, visible_to_avatar_ids
          ) VALUES (
            ${sourceUuid}, ${chunk.content}, ${chunk.chunkIndex},
            ${JSON.stringify(chunk.embedding)}::vector, ${profileUuid},
            ${generationUuid}, ${tx.json((chunk.metadata ?? {}) as JSONValue)},
            ${chunk.visibleToAvatarIds ?? null}
          )
        `
      }
      await tx`
        UPDATE knowledge_sources
        SET status = 'ready', updated_at = NOW()
        WHERE id = ${sourceUuid}
      `
      return replacement.chunks.length
    })
  }

  async validateCorpusGeneration(reindexOperationId: string): Promise<CorpusValidation> {
    const operationUuid = requireUuid('reindex_operation_', reindexOperationId)
    const [row] = await this.sql<
      {
        generation_id: string
        profile_id: string
        expected_source_count: number
        completed_source_count: number
        completed_nonempty_source_count: number
        expected_chunk_count: number
        actual_chunk_count: number
        non_null_vector_count: number
      }[]
    >`
      SELECT op.corpus_generation_id AS generation_id,
        op.embedding_profile_id AS profile_id,
        op.expected_source_count,
        (
          SELECT COUNT(*)::int FROM reindex_operation_sources progress
          WHERE progress.reindex_operation_id = op.id AND progress.status = 'completed'
        ) AS completed_source_count,
        (
          SELECT COUNT(*)::int FROM reindex_operation_sources progress
          WHERE progress.reindex_operation_id = op.id
            AND progress.status = 'completed'
            AND COALESCE(progress.expected_chunk_count, 0) > 0
        ) AS completed_nonempty_source_count,
        (
          SELECT COALESCE(SUM(progress.expected_chunk_count), 0)::int
          FROM reindex_operation_sources progress
          WHERE progress.reindex_operation_id = op.id
        ) AS expected_chunk_count,
        (
          SELECT COUNT(*)::int FROM knowledge_chunks chunks
          WHERE chunks.corpus_generation_id = op.corpus_generation_id
            AND chunks.embedding_profile_id = op.embedding_profile_id
        ) AS actual_chunk_count,
        (
          SELECT COUNT(chunks.embedding)::int FROM knowledge_chunks chunks
          WHERE chunks.corpus_generation_id = op.corpus_generation_id
            AND chunks.embedding_profile_id = op.embedding_profile_id
        ) AS non_null_vector_count
      FROM reindex_operations op
      WHERE op.id = ${operationUuid}
    `
    if (row === undefined) throw new Error('Reindex operation not found.')
    const valid =
      row.completed_source_count === row.expected_source_count &&
      row.completed_nonempty_source_count === row.expected_source_count &&
      row.expected_source_count > 0 &&
      row.expected_chunk_count === row.actual_chunk_count &&
      row.actual_chunk_count > 0 &&
      row.actual_chunk_count === row.non_null_vector_count
    if (valid) {
      await this.sql`
        UPDATE corpus_generations
        SET status = 'validated', validated_at = NOW()
        WHERE id = ${row.generation_id} AND embedding_profile_id = ${row.profile_id}
      `
    }
    return {
      valid,
      corpusGenerationId: `corpus_generation_${row.generation_id}`,
      embeddingProfileId: `embedding_profile_${row.profile_id}`,
      expectedSourceCount: row.expected_source_count,
      completedSourceCount: row.completed_source_count,
      expectedChunkCount: row.expected_chunk_count,
      actualChunkCount: row.actual_chunk_count,
      nonNullVectorCount: row.non_null_vector_count,
      ...(valid ? {} : { failureDetails: 'Generation is incomplete or contains null vectors.' }),
    }
  }

  // eslint-disable-next-line max-lines-per-function
  async promoteCorpusGeneration(reindexOperationId: string): Promise<ActiveCorpus> {
    const operationUuid = requireUuid('reindex_operation_', reindexOperationId)
    // eslint-disable-next-line max-lines-per-function
    return this.sql.begin(async (tx) => {
      const [operation] = await tx<
        {
          generation_id: string
          profile_id: string
          status: string
        }[]
      >`
        SELECT corpus_generation_id AS generation_id, embedding_profile_id AS profile_id, status
        FROM reindex_operations WHERE id = ${operationUuid} FOR UPDATE
      `
      if (operation === undefined) throw new Error('Reindex operation not found.')
      const [validation] = await tx<
        {
          expected_source_count: number
          completed_source_count: number
          completed_nonempty_source_count: number
          expected_chunk_count: number
          actual_chunk_count: number
          non_null_vector_count: number
        }[]
      >`
        SELECT op.expected_source_count,
          (
            SELECT COUNT(*)::int FROM reindex_operation_sources progress
            WHERE progress.reindex_operation_id = op.id AND progress.status = 'completed'
          ) AS completed_source_count,
          (
            SELECT COUNT(*)::int FROM reindex_operation_sources progress
            WHERE progress.reindex_operation_id = op.id
              AND progress.status = 'completed'
              AND COALESCE(progress.expected_chunk_count, 0) > 0
          ) AS completed_nonempty_source_count,
          (
            SELECT COALESCE(SUM(progress.expected_chunk_count), 0)::int
            FROM reindex_operation_sources progress
            WHERE progress.reindex_operation_id = op.id
          ) AS expected_chunk_count,
          (
            SELECT COUNT(*)::int FROM knowledge_chunks chunks
            WHERE chunks.corpus_generation_id = op.corpus_generation_id
              AND chunks.embedding_profile_id = op.embedding_profile_id
          ) AS actual_chunk_count,
          (
            SELECT COUNT(chunks.embedding)::int FROM knowledge_chunks chunks
            WHERE chunks.corpus_generation_id = op.corpus_generation_id
              AND chunks.embedding_profile_id = op.embedding_profile_id
          ) AS non_null_vector_count
        FROM reindex_operations op
        WHERE op.id = ${operationUuid}
      `
      if (
        validation === undefined ||
        validation.completed_source_count !== validation.expected_source_count ||
        validation.completed_nonempty_source_count !== validation.expected_source_count ||
        validation.expected_source_count === 0 ||
        validation.expected_chunk_count !== validation.actual_chunk_count ||
        validation.actual_chunk_count === 0 ||
        validation.actual_chunk_count !== validation.non_null_vector_count
      ) {
        throw new Error('Corpus generation validation failed; active corpus was preserved.')
      }
      await tx`
        UPDATE corpus_generations
        SET status = 'superseded'
        WHERE status = 'active' AND id <> ${operation.generation_id}
      `
      await tx`
        UPDATE corpus_generations
        SET status = 'active', activated_at = NOW()
        WHERE id = ${operation.generation_id} AND embedding_profile_id = ${operation.profile_id}
      `
      await tx`
        UPDATE knowledge_corpus_state
        SET active_generation_id = ${operation.generation_id}, active_profile_id = ${operation.profile_id}
        WHERE id = 1
      `
      await tx`
        UPDATE reindex_operations
        SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = ${operationUuid}
      `
      const [profile] = await tx<
        {
          id: string
          provider: string
          model: string
          dimensions: number
        }[]
      >`
        SELECT id, provider, model, dimensions
        FROM embedding_profiles WHERE id = ${operation.profile_id}
      `
      if (profile === undefined) throw new Error('Embedding profile not found.')
      return {
        corpusGenerationId: `corpus_generation_${operation.generation_id}`,
        embeddingProfileId: `embedding_profile_${operation.profile_id}`,
        profile: {
          provider: profile.provider,
          model: profile.model,
          dimensions: profile.dimensions,
        },
      }
    })
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
      SELECT c.id, c.source_id, c.content, c.chunk_index, c.embedding::text,
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

function requireUuid(prefix: string, value: string): string {
  const uuid = stripPrefix(prefix, value)
  if (uuid.length === 0 || extractUuid(prefix, value) === null) {
    throw new Error(`Invalid ${prefix} identifier.`)
  }
  return uuid
}

function rowToOperation(row: ReindexOperationRow): ReindexOperation {
  return {
    reindexOperationId: `reindex_operation_${row.id}`,
    corpusGenerationId: `corpus_generation_${row.corpus_generation_id}`,
    embeddingProfileId: `embedding_profile_${row.embedding_profile_id}`,
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

function rowToSourceProgress(row: ReindexSourceProgressRow): ReindexSourceProgress {
  return {
    reindexOperationId: `reindex_operation_${row.reindex_operation_id}`,
    sourceId: `knowledge_source_${row.source_id}`,
    status: row.status,
    attempts: row.attempts,
    ...(row.expected_chunk_count !== null ? { expectedChunkCount: row.expected_chunk_count } : {}),
    completedChunkCount: row.completed_chunk_count,
    ...(row.started_at !== null ? { startedAt: row.started_at.toISOString() } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at.toISOString() } : {}),
    ...(row.failure_details !== null ? { failureDetails: row.failure_details } : {}),
  }
}

function rowToKnowledgeChunk(row: ChunkRow): KnowledgeChunk {
  const metadata =
    typeof row.metadata === 'object' && row.metadata !== null && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : undefined
  return {
    chunkId: `knowledge_chunk_${row.id}`,
    sourceId: `knowledge_source_${row.source_id}`,
    content: row.content,
    chunkIndex: row.chunk_index,
    ...(row.embedding !== null ? { embedding: parseVectorText(row.embedding) } : {}),
    ...(row.embedding_profile_id !== null
      ? { embeddingProfileId: `embedding_profile_${row.embedding_profile_id}` }
      : {}),
    ...(row.corpus_generation_id !== null
      ? { corpusGenerationId: `corpus_generation_${row.corpus_generation_id}` }
      : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(row.visible_to_avatar_ids !== null && row.visible_to_avatar_ids.length > 0
      ? { visibleToAvatarIds: row.visible_to_avatar_ids }
      : {}),
    createdAt: row.created_at.toISOString(),
  }
}

function parseVectorText(value: string): number[] {
  const content = value.trim().replace(/^\[/, '').replace(/\]$/, '').trim()
  if (content.length === 0) return []
  return content.split(',').map((entry) => Number(entry.trim()))
}

function boundFailureDetails(value: string): string {
  return value.slice(0, MAX_REINDEX_FAILURE_DETAILS_LENGTH)
}
