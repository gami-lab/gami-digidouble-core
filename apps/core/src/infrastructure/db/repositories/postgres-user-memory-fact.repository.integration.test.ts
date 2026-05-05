import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresUserMemoryFactRepository } from './postgres-user-memory-fact.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresUserMemoryFactRepository', () => {
  let sql: Sql
  let repository: PostgresUserMemoryFactRepository

  beforeAll(() => {
    sql = createTestSql()
    repository = new PostgresUserMemoryFactRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('upsert inserts and findById returns a fact', async () => {
    const created = await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'language',
      value: 'en',
      confidence: 0.7,
    })
    const found = await repository.findById(created.id)

    expect(created.id.startsWith('umf_')).toBe(true)
    expect(found).toEqual(created)
  })

  it('upsert updates an existing fact with same (userId, category, key)', async () => {
    const first = await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'language',
      value: 'en',
      confidence: 0.5,
    })
    const second = await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'language',
      value: 'fr',
      confidence: 0.9,
    })

    expect(second.id).toBe(first.id)
    expect(second.value).toBe('fr')
    expect(second.confidence).toBe(0.9)
    expect(Date.parse(second.updatedAt)).toBeGreaterThanOrEqual(Date.parse(first.updatedAt))
  })

  it('findByUserId returns user facts ordered by updatedAt desc', async () => {
    await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'language',
      value: 'en',
      confidence: 0.5,
    })
    const newer = await repository.upsert({
      userId: 'user_1',
      category: 'constraint',
      key: 'timezone',
      value: 'UTC+1',
      confidence: null,
    })

    const facts = await repository.findByUserId('user_1')
    expect(facts).toHaveLength(2)
    expect(facts[0]?.id).toBe(newer.id)
  })

  it('deleteById removes existing fact and returns false for unknown id', async () => {
    const created = await repository.upsert({
      userId: 'user_1',
      category: 'goal',
      key: 'topic_interest',
      value: 'history',
      confidence: 0.6,
    })

    await expect(repository.deleteById(created.id)).resolves.toBe(true)
    await expect(repository.findById(created.id)).resolves.toBeNull()
    await expect(repository.deleteById('umf_missing')).resolves.toBe(false)
  })
})
