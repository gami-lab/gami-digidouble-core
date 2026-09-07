import postgres from 'postgres'
import type { Sql } from 'postgres'
import { alignPostgresSchema } from './schema-alignment.js'

export const DB_AVAILABLE = Boolean(process.env['DATABASE_URL'])

export function createTestSql(): Sql {
  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error('DATABASE_URL is required for integration tests')
  }

  // onnotice suppresses PostgreSQL NOTICE messages (e.g. "relation already
  // exists, skipping" from CREATE TABLE IF NOT EXISTS) so they don't leak
  // as console.log output during tests.
  return postgres(url, { max: 2, onnotice: () => {} })
}

export async function truncateAllTables(sql: Sql): Promise<void> {
  // Keep this list aligned with migration table additions for integration cleanup.
  await sql`TRUNCATE model_config, reindex_operation_sources, reindex_operations, corpus_generation_sources, knowledge_corpus_state, corpus_generations, embedding_profiles, conversation_memories, conversation_working_memories, avatar_session_memories, session_memories, user_memory_facts, event_log, messages, conversations, gm_states, ingestion_jobs, knowledge_chunks, knowledge_sources, sessions, avatars, scenarios, users CASCADE`
  await sql`INSERT INTO knowledge_corpus_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
}

export async function ensureSchemaAlignment(sql: Sql): Promise<void> {
  await alignPostgresSchema(sql)
}
