import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { assertTestDatabaseUrl } from './src/infrastructure/db/test-helpers.js'

// Recreates the integration test database from the canonical schema before every run, so tests
// never touch the dev database (DATABASE_URL) and never run against a stale schema.
// Without TEST_DATABASE_URL the database-backed suites skip themselves (DB_AVAILABLE).
export default async function globalSetup(): Promise<void> {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)))
  } catch {
    // .env is optional — CI injects TEST_DATABASE_URL directly.
  }
  const testUrl = process.env['TEST_DATABASE_URL']
  if (testUrl === undefined || testUrl.length === 0) return

  const databaseName = assertTestDatabaseUrl(testUrl)
  const maintenanceUrl = new URL(testUrl)
  maintenanceUrl.pathname = '/postgres'

  const admin = postgres(maintenanceUrl.toString(), { max: 1, onnotice: () => {} })
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`)
  } finally {
    await admin.end()
  }

  const schema = readFileSync(
    fileURLToPath(new URL('../../infra/postgres/init.sql', import.meta.url)),
    'utf8',
  )
  const test = postgres(testUrl, { max: 1, onnotice: () => {} })
  try {
    await test.unsafe(schema)
  } finally {
    await test.end()
  }
}
