import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresScenarioRepository', () => {
  let sql: Sql
  let repo: PostgresScenarioRepository

  beforeAll(() => {
    sql = createTestSql()
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

  it('update keeps config as object (not serialized string)', async () => {
    const created = await repo.create({ name: 'Config update' })
    const updated = await repo.update(created.scenarioId, {
      config: {
        worldContext: 'A guided experience',
        avatarAvailability: { initialAvatarIds: ['avatar_1'] },
      },
    })

    expect(typeof updated.config).toBe('object')
    expect(updated.config).toEqual({
      worldContext: 'A guided experience',
      avatarAvailability: { initialAvatarIds: ['avatar_1'] },
    })

    const listed = await repo.list()
    const reloaded = listed.find((scenario) => scenario.scenarioId === created.scenarioId)
    expect(reloaded?.config).toEqual(updated.config)
  })

  it('persists modelSelection in its own column, separate from config, and supports clearing', async () => {
    const created = await repo.create({
      name: 'Scenario Models',
      config: { language: 'fr' },
      modelSelection: {
        defaultProfile: { provider: 'openai', model: 'gpt-4o' },
        gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      },
    })

    expect(created.modelSelection).toEqual({
      defaultProfile: { provider: 'openai', model: 'gpt-4o' },
      gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    })
    expect(created.config).toEqual({ language: 'fr' })

    const cleared = await repo.update(created.scenarioId, { modelSelection: null })
    expect(cleared.modelSelection).toBeUndefined()
    expect(cleared.config).toEqual({ language: 'fr' })
  })
})
