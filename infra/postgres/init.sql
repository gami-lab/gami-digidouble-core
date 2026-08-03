-- PostgreSQL initialization script
-- Runs once on first container start (docker-entrypoint-initdb.d)
-- This is the canonical schema — no separate migration files.

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Verify pgvector
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RAISE EXCEPTION 'pgvector extension was not created successfully';
  END IF;
END;
$$;

-- ── Scenarios ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scenarios (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'draft',
  objectives          TEXT[]      NOT NULL DEFAULT '{}',
  world_context       TEXT        NOT NULL DEFAULT '',
  avatar_availability JSONB       NOT NULL DEFAULT '{"initialAvatarIds": []}',
  config              JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Own column (not nested in config) for scenario-scoped model overrides.
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS model_selection JSONB;

-- ── Avatars ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS avatars (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id      UUID        NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'draft',
  description      TEXT,
  tone             TEXT,
  persona_prompt   TEXT        NOT NULL,
  adjustments      TEXT[],
  computed_traits  JSONB,
  config           JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Knowledge ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     UUID        NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  knowledge_type  TEXT        NOT NULL,
  format          TEXT        NOT NULL,
  uri_or_path     TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  visible_to_avatar_ids TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (knowledge_type IN ('memory', 'world', 'media')),
  CHECK (format IN ('pdf', 'text', 'markdown', 'url', 'media')),
  CHECK (status IN ('pending', 'ready', 'error'))
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID        NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  chunk_index     INT         NOT NULL,
  embedding       VECTOR(16),
  metadata        JSONB       NOT NULL DEFAULT '{}',
  visible_to_avatar_ids TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, chunk_index)
);

-- Backward-compatible schema alignment for existing local volumes.
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS visible_to_avatar_ids TEXT[];
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS visible_to_avatar_ids TEXT[];
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS visibility_policy TEXT CHECK (visibility_policy IN ('all', 'avatars', 'none'));

-- Ensure the embedding column keeps a fixed dimension required by ivfflat.
DO $$
BEGIN
  BEGIN
    ALTER TABLE knowledge_chunks
      ALTER COLUMN embedding TYPE VECTOR(16)
      USING CASE
        WHEN embedding IS NULL THEN NULL
        ELSE embedding::vector(16)
      END;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Could not enforce VECTOR(16) on knowledge_chunks.embedding: %', SQLERRM;
  END;
END;
$$;

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID        NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'queued',
  attempts        INT         NOT NULL DEFAULT 0,
  chunk_size      INT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('queued', 'running', 'completed', 'failed'))
);

ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS chunk_size INT;

-- ── Sessions ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT        NOT NULL,
  scenario_id      UUID        NOT NULL REFERENCES scenarios(id),
  active_avatar_id UUID        REFERENCES avatars(id) ON DELETE SET NULL,
  unlocked_avatar_ids UUID[],
  model_override   JSONB,
  avatar_options   JSONB,
  gm_notes         TEXT,
  memory_summary   TEXT,
  status           TEXT        NOT NULL DEFAULT 'active',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ
);

-- Backward-compatible schema alignment for existing local volumes.
-- CREATE TABLE IF NOT EXISTS does not add new columns after initial bootstrap.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS unlocked_avatar_ids UUID[];
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS gm_notes TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS memory_summary TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS model_override JSONB;

-- ── Working Memory ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_memories (
  session_id  UUID        PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  summary     TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS avatar_session_memories (
  session_id  UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  avatar_id   UUID        NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  summary     TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, avatar_id)
);


-- ── Game Master States ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gm_states (
  session_id        UUID        PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  progression       TEXT        NOT NULL DEFAULT '',
  interaction_count INT         NOT NULL DEFAULT 0,
  next_turn_orchestration JSONB,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing volumes may retain legacy current_avatar_id/topics_covered columns. The repository
-- ignores them while the session and memory-compaction stores own those responsibilities.
ALTER TABLE gm_states ADD COLUMN IF NOT EXISTS next_turn_orchestration JSONB;

-- ── Conversations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                  UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  avatar_id                   UUID        NOT NULL REFERENCES avatars(id),
  status                      TEXT        NOT NULL DEFAULT 'active',
  started_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at                    TIMESTAMPTZ,
  started_by                  TEXT,
  reason                      TEXT,
  handoff_from_conversation_id UUID       REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conversation_working_memories (
  conversation_id     UUID        PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  session_id          UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  avatar_id           UUID        NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  summary             TEXT        NOT NULL,
  unresolved_threads  TEXT[]      NOT NULL DEFAULT '{}',
  covered_topics      TEXT[]      NOT NULL DEFAULT '{}',
  candidate_facts     JSONB       NOT NULL DEFAULT '[]'::JSONB,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conversation_working_memories
  ADD COLUMN IF NOT EXISTS covered_topics TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS conversation_memories (
  conversation_id     UUID        PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  session_id          UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id             TEXT        NOT NULL,
  avatar_id           UUID        NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  scenario_id         UUID        NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  summary             TEXT        NOT NULL,
  key_discoveries     TEXT[]      NOT NULL DEFAULT '{}',
  unresolved_topics   TEXT[]      NOT NULL DEFAULT '{}',
  fact_candidates     JSONB       NOT NULL DEFAULT '[]'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Messages ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID   NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata   JSONB
);

-- ── Event Log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_log (
  id             TEXT        PRIMARY KEY DEFAULT 'evt_' || gen_random_uuid()::TEXT,
  session_id     UUID        REFERENCES sessions(id) ON DELETE SET NULL,
  type           TEXT        NOT NULL,
  severity       TEXT        NOT NULL DEFAULT 'info',
  correlation_id TEXT,
  request_id     TEXT,
  payload        JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id         TEXT        PRIMARY KEY,
  persona    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── User Memory Facts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_memory_facts (
  id          TEXT        PRIMARY KEY DEFAULT 'umf_' || gen_random_uuid()::TEXT,
  user_id     TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  key         TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  confidence  REAL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category, key)
);

-- ── Model Config ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_config (
  id          INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config      JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_avatars_scenario_id   ON avatars(scenario_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_scope
  ON knowledge_sources(scenario_id, knowledge_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source_chunk
  ON knowledge_chunks(source_id, chunk_index);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'knowledge_chunks'::regclass
      AND attname = 'embedding'
      AND atttypmod > 0
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
      ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
      WHERE embedding IS NOT NULL;
  ELSE
    RAISE WARNING 'Skipping idx_knowledge_chunks_embedding: embedding has no fixed dimensions.';
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source_status
  ON ingestion_jobs(source_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_scenario_id  ON sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active_avatar_id ON sessions(active_avatar_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_avatar_id ON conversations(avatar_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_event_log_session_id ON event_log(session_id);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(type);
CREATE INDEX IF NOT EXISTS idx_user_memory_facts_user_id ON user_memory_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_session_memories_session_id
  ON avatar_session_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_working_memories_session_id
  ON conversation_working_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memories_scope
  ON conversation_memories(user_id, avatar_id, scenario_id, created_at DESC);
