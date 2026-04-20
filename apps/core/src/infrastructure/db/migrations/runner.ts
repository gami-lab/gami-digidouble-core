import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Sql } from 'postgres'

const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url))

export async function runMigrations(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  let files: string[]
  try {
    files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql'))
      // Migration files must use zero-padded prefixes (001_, 002_, ...).
      .sort()
  } catch (error) {
    throw new Error(`Unable to read migrations directory: ${MIGRATIONS_DIR}`, {
      cause: error,
    })
  }

  for (const file of files) {
    const [existing] = await sql<[{ filename: string }?]>`
      SELECT filename FROM schema_migrations WHERE filename = ${file}
    `
    if (existing) {
      continue
    }

    const content = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
    // Safe here because migrations are local files in this repository, never user input.
    await sql.unsafe(content)
    await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`
  }
}
