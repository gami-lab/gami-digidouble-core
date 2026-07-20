import type { Sql } from 'postgres'

const SCHEMA_ALIGNMENT_STATEMENTS = [
  'ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS model_selection JSONB',
  'ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS visible_to_avatar_ids TEXT[]',
  'ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS visible_to_avatar_ids TEXT[]',
  "ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS visibility_policy TEXT CHECK (visibility_policy IN ('all', 'avatars', 'none'))",
  'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS unlocked_avatar_ids UUID[]',
  'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS gm_notes TEXT',
  'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS memory_summary TEXT',
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
