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
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'draft',
  config      JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Avatars ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS avatars (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id    UUID        NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'draft',
  description    TEXT,
  tone           TEXT,
  persona_prompt TEXT        NOT NULL,
  adjustments    TEXT[],
  config         JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sessions ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT        NOT NULL,
  scenario_id      UUID        NOT NULL REFERENCES scenarios(id),
  active_avatar_id UUID        REFERENCES avatars(id),
  status           TEXT        NOT NULL DEFAULT 'active',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ
);

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
  handoff_from_conversation_id UUID       REFERENCES conversations(id)
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

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_avatars_scenario_id   ON avatars(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scenario_id  ON sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active_avatar_id ON sessions(active_avatar_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_avatar_id ON conversations(avatar_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON messages(conversation_id, created_at);
