import postgres from 'postgres'
import type { Sql } from 'postgres'
import { runMigrations } from './migrations/runner.js'

export const DB_AVAILABLE = Boolean(process.env['DATABASE_URL'])

export async function createTestSql(): Promise<Sql> {
  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error('DATABASE_URL is required for integration tests')
  }

  // onnotice suppresses PostgreSQL NOTICE messages (e.g. "relation already
  // exists, skipping" from CREATE TABLE IF NOT EXISTS in migrations) so they
  // don't leak as console.log output during tests.
  const sql = postgres(url, { max: 2, onnotice: () => {} })
  await runMigrations(sql)
  return sql
}

export async function truncateAllTables(sql: Sql): Promise<void> {
  // Keep this list aligned with migration table additions for integration cleanup.
  await sql`TRUNCATE messages, sessions, avatars, scenarios CASCADE`
}
