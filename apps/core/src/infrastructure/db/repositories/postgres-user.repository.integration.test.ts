import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresUserRepository } from './postgres-user.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresUserRepository', () => {
  let sql: Sql
  let userRepository: PostgresUserRepository

  beforeAll(() => {
    sql = createTestSql()
    userRepository = new PostgresUserRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('upsert creates a new user and findById returns it', async () => {
    const created = await userRepository.upsert('user_1', { name: 'Sam' })
    const found = await userRepository.findById('user_1')

    expect(created.userId).toBe('user_1')
    expect(created.persona).toEqual({ name: 'Sam' })
    expect(found).toEqual(created)
  })

  it('upsert replaces persona and advances updatedAt', async () => {
    const first = await userRepository.upsert('user_1', { name: 'Sam' })
    const second = await userRepository.upsert('user_1', { name: 'Maya' })

    expect(second.userId).toBe('user_1')
    expect(second.persona).toEqual({ name: 'Maya' })
    expect(Date.parse(second.updatedAt)).toBeGreaterThanOrEqual(Date.parse(first.updatedAt))
  })

  it('upsert with empty persona stores and returns an empty object', async () => {
    await userRepository.upsert('user_empty', {})
    const found = await userRepository.findById('user_empty')

    expect(found?.persona).toEqual({})
  })

  it('round-trips name and roleInWorld fields', async () => {
    await userRepository.upsert('user_roundtrip', {
      name: 'Maya',
      roleInWorld: 'student',
    })
    const found = await userRepository.findById('user_roundtrip')

    expect(found?.persona).toEqual({
      name: 'Maya',
      roleInWorld: 'student',
    })
  })

  it('findById returns null for unknown user', async () => {
    await expect(userRepository.findById('missing_user')).resolves.toBeNull()
  })

  it('round-trips avatarRelationships arrays', async () => {
    await userRepository.upsert('user_hints', {
      avatarRelationships: ['Friend of Eva', 'Brother of Tom'],
    })
    const found = await userRepository.findById('user_hints')

    expect(found?.persona).toEqual({ avatarRelationships: ['Friend of Eva', 'Brother of Tom'] })
  })
})
