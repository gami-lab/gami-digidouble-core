import type { ISql, Sql } from 'postgres'
import type {
  ActiveCorpus,
  CorpusValidation,
} from '../../../application/ports/IKnowledgeCorpusRepository.js'
import { requireUuid } from './postgres-knowledge-corpus.mapping.js'

type GenerationCounts = {
  generation_id: string
  profile_id: string
  expected_source_count: number
  completed_source_count: number
  completed_nonempty_source_count: number
  expected_chunk_count: number
  actual_chunk_count: number
  non_null_vector_count: number
}

type OperationLock = {
  generation_id: string
  profile_id: string
  expected_generation_id: string | null
  expected_profile_id: string | null
}

type ProfileRow = { provider: string; model: string; dimensions: number }

async function selectGenerationCounts(
  sql: ISql,
  operationUuid: string,
): Promise<GenerationCounts | undefined> {
  const [row] = await sql<GenerationCounts[]>`
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
  return row
}

function isEmptyGeneration(counts: GenerationCounts): boolean {
  return (
    counts.expected_chunk_count === 0 &&
    counts.actual_chunk_count === 0 &&
    counts.non_null_vector_count === 0
  )
}

function isFullyEmbeddedGeneration(counts: GenerationCounts): boolean {
  return (
    counts.completed_nonempty_source_count === counts.expected_source_count &&
    counts.expected_chunk_count === counts.actual_chunk_count &&
    counts.actual_chunk_count > 0 &&
    counts.actual_chunk_count === counts.non_null_vector_count
  )
}

function isCompleteGeneration(counts: GenerationCounts): boolean {
  if (counts.completed_source_count !== counts.expected_source_count) return false
  return counts.expected_source_count === 0
    ? isEmptyGeneration(counts)
    : isFullyEmbeddedGeneration(counts)
}

export async function validateCorpusGeneration(
  sql: ISql,
  reindexOperationId: string,
): Promise<CorpusValidation> {
  const counts = await selectGenerationCounts(
    sql,
    requireUuid('reindex_operation_', reindexOperationId),
  )
  if (counts === undefined) throw new Error('Reindex operation not found.')
  const valid = isCompleteGeneration(counts)
  if (valid) {
    await sql`
      UPDATE corpus_generations
      SET status = 'validated', validated_at = NOW()
      WHERE id = ${counts.generation_id} AND embedding_profile_id = ${counts.profile_id}
    `
  }
  return {
    valid,
    corpusGenerationId: `corpus_generation_${counts.generation_id}`,
    embeddingProfileId: `embedding_profile_${counts.profile_id}`,
    expectedSourceCount: counts.expected_source_count,
    completedSourceCount: counts.completed_source_count,
    expectedChunkCount: counts.expected_chunk_count,
    actualChunkCount: counts.actual_chunk_count,
    nonNullVectorCount: counts.non_null_vector_count,
    ...(valid ? {} : { failureDetails: 'Generation is incomplete or contains null vectors.' }),
  }
}

async function lockOperationAgainstActiveCorpus(
  tx: ISql,
  operationUuid: string,
): Promise<OperationLock> {
  const [operation] = await tx<OperationLock[]>`
    SELECT corpus_generation_id AS generation_id, embedding_profile_id AS profile_id,
      expected_active_generation_id AS expected_generation_id,
      expected_active_profile_id AS expected_profile_id
    FROM reindex_operations WHERE id = ${operationUuid} FOR UPDATE
  `
  if (operation === undefined) throw new Error('Reindex operation not found.')
  const [activeState] = await tx<
    { active_generation_id: string | null; active_profile_id: string | null }[]
  >`
    SELECT active_generation_id, active_profile_id
    FROM knowledge_corpus_state
    WHERE id = 1
    FOR UPDATE
  `
  if (activeState === undefined) throw new Error('Active corpus state is unavailable.')
  if (
    activeState.active_generation_id !== operation.expected_generation_id ||
    activeState.active_profile_id !== operation.expected_profile_id
  ) {
    throw new Error('Active corpus changed; active corpus was preserved.')
  }
  return operation
}

async function activateGeneration(
  tx: ISql,
  operationUuid: string,
  operation: OperationLock,
): Promise<void> {
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
}

export async function promoteCorpusGeneration(
  sql: Sql,
  reindexOperationId: string,
): Promise<ActiveCorpus> {
  const operationUuid = requireUuid('reindex_operation_', reindexOperationId)
  return sql.begin(async (tx) => {
    const operation = await lockOperationAgainstActiveCorpus(tx, operationUuid)
    const counts = await selectGenerationCounts(tx, operationUuid)
    if (counts === undefined || !isCompleteGeneration(counts)) {
      throw new Error('Corpus generation validation failed; active corpus was preserved.')
    }
    await activateGeneration(tx, operationUuid, operation)
    const [profile] = await tx<ProfileRow[]>`
      SELECT provider, model, dimensions
      FROM embedding_profiles WHERE id = ${operation.profile_id}
    `
    if (profile === undefined) throw new Error('Embedding profile not found.')
    return {
      corpusGenerationId: `corpus_generation_${operation.generation_id}`,
      embeddingProfileId: `embedding_profile_${operation.profile_id}`,
      profile: { provider: profile.provider, model: profile.model, dimensions: profile.dimensions },
    }
  })
}
