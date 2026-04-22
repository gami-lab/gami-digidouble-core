import postgres from 'postgres'
import type { Sql } from 'postgres'

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
  await sql`TRUNCATE messages, conversations, gm_states, sessions, avatars, scenarios CASCADE`
}
