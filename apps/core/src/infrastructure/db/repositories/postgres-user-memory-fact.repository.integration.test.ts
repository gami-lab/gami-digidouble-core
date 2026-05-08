import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresUserMemoryFactRepository } from './postgres-user-memory-fact.repository.js'

let repository!: PostgresUserMemoryFactRepository

function defineFindCases(): void {
  it('findByUserId returns empty array when user has no facts', async () => {
    await expect(repository.findByUserId('missing_user')).resolves.toEqual([])
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
    })

    const facts = await repository.findByUserId('user_1')
    expect(facts).toHaveLength(2)
    expect(facts[0]?.id).toBe(newer.id)
  })

  it('findByUserId returns only facts for the requested user', async () => {
    await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'language',
      value: 'en',
      confidence: 0.5,
    })
    await repository.upsert({
      userId: 'user_2',
      category: 'goal',
      key: 'topic_interest',
      value: 'history',
      confidence: 0.4,
    })

    const user1Facts = await repository.findByUserId('user_1')
    expect(user1Facts).toHaveLength(1)
    expect(user1Facts[0]?.userId).toBe('user_1')
  })

  it('findById returns null for unknown id', async () => {
    await expect(repository.findById('umf_unknown')).resolves.toBeNull()
  })
}

function defineUpsertCases(): void {
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

  it('upsert with different key for same user creates distinct facts', async () => {
    await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'language',
      value: 'en',
      confidence: 0.5,
    })
    await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'timezone',
      value: 'UTC+1',
      confidence: 0.6,
    })

    const facts = await repository.findByUserId('user_1')
    expect(facts).toHaveLength(2)
    expect(new Set(facts.map((fact) => fact.key))).toEqual(new Set(['language', 'timezone']))
  })

  it('round-trips confidence value as-is', async () => {
    const created = await repository.upsert({
      userId: 'user_conf',
      category: 'identity',
      key: 'role',
      value: 'mentor',
      confidence: 0.33,
    })

    const found = await repository.findById(created.id)
    expect(found?.confidence).toBe(0.33)
  })
}

function defineDeleteCases(): void {
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
}

describe.skipIf(!DB_AVAILABLE)('PostgresUserMemoryFactRepository', () => {
  let sql!: Sql

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

  defineFindCases()
  defineUpsertCases()
  defineDeleteCases()
})
