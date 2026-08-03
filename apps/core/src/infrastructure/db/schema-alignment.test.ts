import { describe, expect, it, vi } from 'vitest'
import { alignPostgresSchema, getSchemaAlignmentStatements } from './schema-alignment.js'

describe('alignPostgresSchema', () => {
  it('applies each rerunnable schema-alignment statement once at startup', async () => {
    const unsafe = vi.fn().mockResolvedValue([])
    const sql = { unsafe }

    await alignPostgresSchema(sql as never)

    const recordedStatements = unsafe.mock.calls.map((call) => String(call[0]))

    expect(recordedStatements).toEqual(getSchemaAlignmentStatements())
    expect(recordedStatements).toContain(
      'ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS chunk_size INT',
    )
  })
})
