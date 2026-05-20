import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresModelConfigRepository } from './postgres-model-config.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresModelConfigRepository', () => {
  let sql!: Sql
  let repository!: PostgresModelConfigRepository

  beforeAll(() => {
    sql = createTestSql()
    repository = new PostgresModelConfigRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('get returns null when no row exists', async () => {
    await expect(repository.get()).resolves.toBeNull()
  })

  it('upsert inserts then updates single row', async () => {
    const first = await repository.upsert({
      globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
      roleOverrides: {},
      updatedAt: '2026-05-18T00:00:00.000Z',
    })

    const second = await repository.upsert({
      globalDefault: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
      roleOverrides: { gameMaster: { model: 'claude-3-5-haiku' } },
      updatedAt: '2026-05-18T00:00:00.000Z',
    })

    expect(first.globalDefault.provider).toBe('openai')
    expect(second.globalDefault.provider).toBe('anthropic')
    expect(second.roleOverrides.gameMaster?.model).toBe('claude-3-5-haiku')

    const rows = await sql<
      Array<{ count: string }>
    >`SELECT COUNT(*)::TEXT AS count FROM model_config`
    expect(Number(rows[0]?.count ?? '0')).toBe(1)
  })

  it('persists config across repository re-instantiation', async () => {
    await repository.upsert({
      globalDefault: { provider: 'mistral', model: 'mistral-large-latest' },
      roleOverrides: { memory: { model: 'mistral-medium-latest' } },
      updatedAt: '2026-05-20T00:00:00.000Z',
    })

    const restartedRepository = new PostgresModelConfigRepository(sql)
    const loaded = await restartedRepository.get()

    expect(loaded).not.toBeNull()
    expect(loaded?.globalDefault.provider).toBe('mistral')
    expect(loaded?.globalDefault.model).toBe('mistral-large-latest')
    expect(loaded?.roleOverrides.memory?.model).toBe('mistral-medium-latest')
  })
})
