-- 001_initial_schema.sql
-- Initial schema for Gami DigiDouble Core — Persistence Layer v1 (EPIC 2.3)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Scenarios
CREATE TABLE IF NOT EXISTS scenarios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  status      TEXT        NOT NULL DEFAULT 'draft',
  config      JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Avatars
CREATE TABLE IF NOT EXISTS avatars (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id    UUID        NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  slug           TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'draft',
  description    TEXT,
  tone           TEXT,
  persona_prompt TEXT        NOT NULL,
  config         JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT        NOT NULL,
  scenario_id      UUID        NOT NULL REFERENCES scenarios(id),
  status           TEXT        NOT NULL DEFAULT 'active',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  avatar_id  UUID        REFERENCES avatars(id),
  metadata   JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_avatars_scenario_id ON avatars(scenario_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_avatars_scenario_slug ON avatars(scenario_id, slug);
CREATE INDEX IF NOT EXISTS idx_sessions_scenario_id ON sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(session_id, created_at);
