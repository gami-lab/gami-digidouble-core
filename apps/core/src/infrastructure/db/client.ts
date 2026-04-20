import postgres from 'postgres'
import type { Sql } from 'postgres'

let sql: Sql | null = null
let sqlUrl: string | null = null

export function getDbClient(url: string): Sql {
  if (sql && sqlUrl !== url) {
    throw new Error(
      'Database client already initialized with a different URL. Restart the application to change DATABASE_URL.',
    )
  }

  if (!sql) {
    sql = postgres(url, { max: 10 })
    sqlUrl = url
  }

  return sql
}

export async function closeDbClient(): Promise<void> {
  if (!sql) {
    return
  }

  await sql.end()
  sql = null
  sqlUrl = null
}
