import type { Sql } from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql } from './test-helpers.js'

describe.skipIf(!DB_AVAILABLE)('canonical PostgreSQL schema', () => {
  let sql: Sql

  beforeAll(() => {
    sql = createTestSql()
  })

  afterAll(async () => {
    await sql.end()
  })

  it('contains only the current Game Master state columns', async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'gm_states'
      ORDER BY ordinal_position
    `

    expect(rows.map((row) => row.column_name)).toEqual([
      'session_id',
      'progression',
      'interaction_count',
      'next_turn_orchestration',
      'updated_at',
    ])
  })

  it('keeps the current vector profile and identity constraints', async () => {
    const [embeddingColumn] = await sql<{ formatted_type: string }[]>`
      SELECT format_type(a.atttypid, a.atttypmod) AS formatted_type
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      WHERE c.relname = 'knowledge_chunks' AND a.attname = 'embedding'
    `
    const constraints = await sql<{ conname: string }[]>`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'knowledge_chunks'::regclass
    `

    expect(embeddingColumn?.formatted_type).toBe('vector(16)')
    expect(constraints.map((constraint) => constraint.conname)).toEqual(
      expect.arrayContaining([
        'knowledge_chunks_generation_profile_fkey',
        'knowledge_chunks_embedding_identity_check',
      ]),
    )
  })
})
