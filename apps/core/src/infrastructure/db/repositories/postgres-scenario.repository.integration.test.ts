import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresScenarioRepository', () => {
  let sql: Sql
  let repo: PostgresScenarioRepository

  beforeAll(async () => {
    sql = await createTestSql()
    repo = new PostgresScenarioRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('creates a scenario and returns it with generated id and timestamps', async () => {
    const result = await repo.create({
      name: 'Test Scenario',
    })

    expect(result.scenarioId).toBeTypeOf('string')
    expect(result.name).toBe('Test Scenario')
    expect(result.status).toBe('draft')
    expect(result.createdAt).toBeTypeOf('string')
    expect(result.updatedAt).toBeTypeOf('string')
  })

  it('creates a scenario with explicit status and config', async () => {
    const result = await repo.create({
      name: 'Active Scenario',
      status: 'active',
      config: { language: 'fr' },
    })

    expect(result.status).toBe('active')
    expect(result.config).toEqual({ language: 'fr' })
  })

  it('findById returns the scenario by its id', async () => {
    const created = await repo.create({ name: 'Findable' })
    const found = await repo.findById(created.scenarioId)

    expect(found).not.toBeNull()
    expect(found?.scenarioId).toBe(created.scenarioId)
    expect(found?.name).toBe('Findable')
  })

  it('findById returns null for a non-existent id', async () => {
    const result = await repo.findById('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })

  it('list returns scenarios ordered by created_at DESC', async () => {
    const older = await repo.create({ name: 'Older' })
    const newer = await repo.create({ name: 'Newer' })

    const listed = await repo.list()

    expect(listed.map((scenario) => scenario.scenarioId)).toEqual([
      newer.scenarioId,
      older.scenarioId,
    ])
  })

  it('delete removes an existing scenario', async () => {
    const created = await repo.create({ name: 'To delete' })

    await repo.delete(created.scenarioId)
    const found = await repo.findById(created.scenarioId)

    expect(found).toBeNull()
  })
})
