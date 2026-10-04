import postgres from 'postgres'
import type { Sql } from 'postgres'

// Integration tests never use DATABASE_URL: they truncate every table, so they get their own
// database (recreated by vitest.integration.global-setup.ts) whose name must end in `_test`.
export const DB_AVAILABLE = Boolean(process.env['TEST_DATABASE_URL'])

/** Returns the database name, refusing anything that does not look like a test database. */
export function assertTestDatabaseUrl(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
  if (!/^[A-Za-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `Refusing to use database "${name}" for integration tests: TEST_DATABASE_URL must name a database ending in "_test".`,
    )
  }
  return name
}

export function createTestSql(): Sql {
  const url = process.env['TEST_DATABASE_URL']
  if (!url) {
    throw new Error('TEST_DATABASE_URL is required for integration tests')
  }
  assertTestDatabaseUrl(url)

  // onnotice suppresses PostgreSQL NOTICE messages (e.g. "relation already
  // exists, skipping" from CREATE TABLE IF NOT EXISTS) so they don't leak
  // as console.log output during tests.
  return postgres(url, { max: 2, onnotice: () => {} })
}

export async function truncateAllTables(sql: Sql): Promise<void> {
  // Keep this list aligned with canonical bootstrap table additions for integration cleanup.
  await sql`TRUNCATE model_config, reindex_operation_sources, reindex_operations, corpus_generation_sources, knowledge_corpus_state, corpus_generations, embedding_profiles, conversation_memories, conversation_working_memories, avatar_session_memories, session_memories, event_log, messages, conversations, gm_states, ingestion_jobs, knowledge_chunks, knowledge_sources, sessions, avatars, scenarios, users CASCADE`
  await sql`INSERT INTO knowledge_corpus_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
}
