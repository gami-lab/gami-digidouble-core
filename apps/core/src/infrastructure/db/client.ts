import postgres from 'postgres'
import type { Sql } from 'postgres'

let sql: Sql | null = null

export function getDbClient(url: string): Sql {
  if (!sql) {
    sql = postgres(url, { max: 10 })
  }

  return sql
}

export async function closeDbClient(): Promise<void> {
  if (!sql) {
    return
  }

  await sql.end()
  sql = null
}
