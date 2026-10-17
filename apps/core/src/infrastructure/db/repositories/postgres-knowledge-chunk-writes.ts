import type { ISql, JSONValue, Sql } from 'postgres'
import type {
  ActiveSourceChunkReplacement,
  StagedKnowledgeChunk,
} from '../../../application/ports/IKnowledgeCorpusRepository.js'
import { hashKnowledgeChunkContent } from '../../../domain/knowledge/knowledge-content-hash.js'
import { requireUuid } from './postgres-knowledge-corpus.mapping.js'

type ChunkTarget = { sourceUuid: string; profileUuid: string; generationUuid: string }

type ActiveCorpusLock = {
  generation_id: string | null
  profile_id: string | null
  dimensions: number | null
}

async function insertChunks(
  tx: ISql & Pick<Sql, 'json'>,
  target: ChunkTarget,
  chunks: readonly StagedKnowledgeChunk[],
): Promise<void> {
  for (const chunk of chunks) {
    await tx`
      INSERT INTO knowledge_chunks (
        source_id, content, content_hash, chunk_index, embedding, embedding_profile_id,
        corpus_generation_id, metadata, visible_to_avatar_ids
      ) VALUES (
        ${target.sourceUuid}, ${chunk.content},
        ${chunk.contentHash ?? hashKnowledgeChunkContent(chunk.content)}, ${chunk.chunkIndex},
        ${JSON.stringify(chunk.embedding)}::vector, ${target.profileUuid},
        ${target.generationUuid}, ${tx.json((chunk.metadata ?? {}) as JSONValue)},
        ${chunk.visibleToAvatarIds ?? null}
      )
    `
  }
}

export async function refreshCompletedSourceCount(tx: ISql, operationUuid: string): Promise<void> {
  await tx`
    UPDATE reindex_operations
    SET completed_source_count = (
      SELECT COUNT(*) FROM reindex_operation_sources
      WHERE reindex_operation_id = ${operationUuid} AND status = 'completed'
    ), updated_at = NOW()
    WHERE id = ${operationUuid}
  `
}

function assertStagedChunkIdentity(
  chunks: readonly StagedKnowledgeChunk[],
  expected: { sourceId: string; corpusGenerationId: string; embeddingProfileId: string },
): void {
  const mismatch = chunks.some(
    (chunk) =>
      chunk.sourceId !== expected.sourceId ||
      chunk.corpusGenerationId !== expected.corpusGenerationId ||
      chunk.embeddingProfileId !== expected.embeddingProfileId,
  )
  if (mismatch) throw new Error('Staged chunk identity does not match the reindex operation.')
}

async function markSourceStaged(
  tx: ISql,
  operationUuid: string,
  target: ChunkTarget,
  chunkCount: number,
): Promise<void> {
  await tx`
    UPDATE reindex_operation_sources
    SET status = 'completed', expected_chunk_count = ${chunkCount},
      completed_chunk_count = ${chunkCount}, completed_at = NOW(), updated_at = NOW()
    WHERE reindex_operation_id = ${operationUuid} AND source_id = ${target.sourceUuid}
  `
  await tx`
    UPDATE corpus_generation_sources
    SET status = 'completed', expected_chunk_count = ${chunkCount},
      completed_chunk_count = ${chunkCount}, updated_at = NOW()
    WHERE corpus_generation_id = ${target.generationUuid} AND source_id = ${target.sourceUuid}
  `
  await refreshCompletedSourceCount(tx, operationUuid)
}

export async function replaceStagedSourceChunks(
  sql: Sql,
  reindexOperationId: string,
  sourceId: string,
  chunks: readonly StagedKnowledgeChunk[],
): Promise<number> {
  const operationUuid = requireUuid('reindex_operation_', reindexOperationId)
  const sourceUuid = requireUuid('knowledge_source_', sourceId)
  return sql.begin(async (tx) => {
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
    assertStagedChunkIdentity(chunks, {
      sourceId,
      corpusGenerationId: `corpus_generation_${operation.generation_id}`,
      embeddingProfileId: `embedding_profile_${operation.profile_id}`,
    })
    const target = {
      sourceUuid,
      profileUuid: operation.profile_id,
      generationUuid: operation.generation_id,
    }
    await tx`
      DELETE FROM knowledge_chunks
      WHERE source_id = ${sourceUuid} AND corpus_generation_id = ${operation.generation_id}
    `
    await insertChunks(tx, target, chunks)
    await markSourceStaged(tx, operationUuid, target, chunks.length)
    return chunks.length
  })
}

function assertActiveReplacement(replacement: ActiveSourceChunkReplacement): void {
  if (replacement.chunks.length === 0) {
    throw new Error('At least one vectorized chunk is required.')
  }
  const invalid = replacement.chunks.some(
    (chunk) =>
      chunk.sourceId !== replacement.sourceId ||
      chunk.embeddingProfileId !== replacement.embeddingProfileId ||
      chunk.corpusGenerationId !== replacement.corpusGenerationId ||
      chunk.embedding.some((value) => !Number.isFinite(value)),
  )
  if (invalid) throw new Error('Active source chunk identity or vector is invalid.')
}

function assertReplacementMatchesActiveCorpus(
  active: ActiveCorpusLock | undefined,
  target: ChunkTarget,
  chunks: readonly StagedKnowledgeChunk[],
): void {
  if (
    active === undefined ||
    active.generation_id === null ||
    active.profile_id === null ||
    active.dimensions === null
  ) {
    throw new Error('No active knowledge corpus is configured.')
  }
  if (active.generation_id !== target.generationUuid || active.profile_id !== target.profileUuid) {
    throw new Error('Active embedding profile or corpus generation changed.')
  }
  const { dimensions } = active
  if (chunks.some((chunk) => chunk.embedding.length !== dimensions)) {
    throw new Error('Active source chunk vector dimension does not match the active profile.')
  }
}

export async function replaceActiveSourceChunks(
  sql: Sql,
  replacement: ActiveSourceChunkReplacement,
): Promise<number> {
  const target = {
    sourceUuid: requireUuid('knowledge_source_', replacement.sourceId),
    profileUuid: requireUuid('embedding_profile_', replacement.embeddingProfileId),
    generationUuid: requireUuid('corpus_generation_', replacement.corpusGenerationId),
  }
  assertActiveReplacement(replacement)

  return sql.begin(async (tx) => {
    const [active] = await tx<ActiveCorpusLock[]>`
      SELECT state.active_generation_id AS generation_id,
        state.active_profile_id AS profile_id,
        profile.dimensions
      FROM knowledge_corpus_state state
      JOIN embedding_profiles profile ON profile.id = state.active_profile_id
      WHERE state.id = 1
      FOR UPDATE
    `
    assertReplacementMatchesActiveCorpus(active, target, replacement.chunks)
    await tx`
      DELETE FROM knowledge_chunks
      WHERE source_id = ${target.sourceUuid}
        AND corpus_generation_id = ${target.generationUuid}
        AND embedding_profile_id = ${target.profileUuid}
    `
    await insertChunks(tx, target, replacement.chunks)
    await tx`
      UPDATE knowledge_sources
      SET status = 'ready', updated_at = NOW()
      WHERE id = ${target.sourceUuid}
    `
    return replacement.chunks.length
  })
}
