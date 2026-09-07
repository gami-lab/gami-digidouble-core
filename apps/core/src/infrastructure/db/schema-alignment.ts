import type { Sql } from 'postgres'

const SCHEMA_ALIGNMENT_STATEMENTS = [
  'ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS model_selection JSONB',
  'ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS chunk_size INT',
  'ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS visible_to_avatar_ids TEXT[]',
  'ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS visible_to_avatar_ids TEXT[]',
  "ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS visibility_policy TEXT CHECK (visibility_policy IN ('all', 'avatars', 'none'))",
  `CREATE TABLE IF NOT EXISTS embedding_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    dimensions INT NOT NULL CHECK (dimensions = 16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, model, dimensions)
  )`,
  `CREATE TABLE IF NOT EXISTS corpus_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    embedding_profile_id UUID NOT NULL REFERENCES embedding_profiles(id),
    status TEXT NOT NULL DEFAULT 'staging',
    expected_source_count INT NOT NULL CHECK (expected_source_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    UNIQUE (id, embedding_profile_id),
    CHECK (status IN ('staging', 'validated', 'active', 'superseded', 'failed'))
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_corpus_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    active_generation_id UUID,
    active_profile_id UUID,
    FOREIGN KEY (active_generation_id, active_profile_id)
      REFERENCES corpus_generations(id, embedding_profile_id)
  )`,
  `INSERT INTO knowledge_corpus_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  'ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding_profile_id UUID',
  'ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS corpus_generation_id UUID',
  'ALTER TABLE knowledge_chunks DROP CONSTRAINT IF EXISTS knowledge_chunks_source_id_chunk_index_key',
  `UPDATE knowledge_chunks
   SET embedding = NULL, embedding_profile_id = NULL, corpus_generation_id = NULL
   WHERE embedding IS NOT NULL
     AND (embedding_profile_id IS NULL OR corpus_generation_id IS NULL)`,
  `ALTER TABLE knowledge_chunks
   ALTER COLUMN embedding TYPE VECTOR(16)
   USING CASE WHEN embedding IS NULL THEN NULL ELSE embedding::vector(16) END`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_generation_profile_fkey'
    ) THEN
      ALTER TABLE knowledge_chunks
        ADD CONSTRAINT knowledge_chunks_generation_profile_fkey
        FOREIGN KEY (corpus_generation_id, embedding_profile_id)
        REFERENCES corpus_generations(id, embedding_profile_id);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_embedding_identity_check'
    ) THEN
      ALTER TABLE knowledge_chunks
        ADD CONSTRAINT knowledge_chunks_embedding_identity_check
        CHECK (
          (embedding IS NULL AND embedding_profile_id IS NULL AND corpus_generation_id IS NULL)
          OR
          (embedding IS NOT NULL AND embedding_profile_id IS NOT NULL AND corpus_generation_id IS NOT NULL)
        );
    END IF;
  END;
  $$`,
  `CREATE TABLE IF NOT EXISTS reindex_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corpus_generation_id UUID NOT NULL UNIQUE,
    embedding_profile_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    expected_source_count INT NOT NULL CHECK (expected_source_count >= 0),
    completed_source_count INT NOT NULL DEFAULT 0 CHECK (completed_source_count >= 0),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (corpus_generation_id, embedding_profile_id)
      REFERENCES corpus_generations(id, embedding_profile_id),
    CHECK (status IN ('pending', 'running', 'completed', 'failed'))
  )`,
  'ALTER TABLE reindex_operations ADD COLUMN IF NOT EXISTS expected_active_generation_id UUID',
  'ALTER TABLE reindex_operations ADD COLUMN IF NOT EXISTS expected_active_profile_id UUID',
  `CREATE TABLE IF NOT EXISTS corpus_generation_sources (
    corpus_generation_id UUID NOT NULL REFERENCES corpus_generations(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    expected_chunk_count INT,
    completed_chunk_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (corpus_generation_id, source_id),
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    CHECK (expected_chunk_count IS NULL OR expected_chunk_count >= 0),
    CHECK (completed_chunk_count >= 0)
  )`,
  `CREATE TABLE IF NOT EXISTS reindex_operation_sources (
    reindex_operation_id UUID NOT NULL REFERENCES reindex_operations(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    expected_chunk_count INT,
    completed_chunk_count INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_details TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (reindex_operation_id, source_id),
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    CHECK (expected_chunk_count IS NULL OR expected_chunk_count >= 0),
    CHECK (completed_chunk_count >= 0)
  )`,
  'DROP INDEX IF EXISTS idx_knowledge_chunks_embedding',
  `CREATE INDEX idx_knowledge_chunks_embedding
   ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100) WHERE embedding IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_active_generation
   ON knowledge_chunks(corpus_generation_id, embedding_profile_id, source_id, chunk_index)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_source_generation_chunk_key
   ON knowledge_chunks(source_id, corpus_generation_id, chunk_index)`,
  `CREATE INDEX IF NOT EXISTS idx_reindex_operations_status
   ON reindex_operations(status, created_at DESC)`,
  'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS unlocked_avatar_ids UUID[]',
  'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS gm_notes TEXT',
  'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS memory_summary TEXT',
  'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS model_override JSONB',
  'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS avatar_options JSONB',
  'ALTER TABLE gm_states ADD COLUMN IF NOT EXISTS next_turn_orchestration JSONB',
  'ALTER TABLE avatars ADD COLUMN IF NOT EXISTS computed_traits JSONB',
  "ALTER TABLE conversation_working_memories ADD COLUMN IF NOT EXISTS covered_topics TEXT[] NOT NULL DEFAULT '{}'",
] as const

export async function alignPostgresSchema(sql: Sql): Promise<void> {
  for (const statement of SCHEMA_ALIGNMENT_STATEMENTS) {
    await sql.unsafe(statement)
  }
}

export function getSchemaAlignmentStatements(): readonly string[] {
  return SCHEMA_ALIGNMENT_STATEMENTS
}
