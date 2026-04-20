import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresAvatarRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let avatarRepo: PostgresAvatarRepository
  let scenarioId: string

  beforeAll(async () => {
    sql = await createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    avatarRepo = new PostgresAvatarRepository(sql)
  })

  beforeEach(async () => {
    const scenario = await scenarioRepo.create({
      name: 'Harness',
      slug: `harness-${crypto.randomUUID()}`,
    })
    scenarioId = scenario.scenarioId
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('creates an avatar and returns it with generated id and timestamps', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Test Avatar',
      slug: 'test-avatar',
      personaPrompt: 'You are a test avatar.',
    })

    expect(result.avatarId).toBeTypeOf('string')
    expect(result.scenarioId).toBe(scenarioId)
    expect(result.name).toBe('Test Avatar')
    expect(result.slug).toBe('test-avatar')
    expect(result.status).toBe('active')
    expect(result.personaPrompt).toBe('You are a test avatar.')
    expect(result.createdAt).toBeTypeOf('string')
    expect(result.updatedAt).toBeTypeOf('string')
  })

  it('creates an avatar with optional fields', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Rich Avatar',
      slug: 'rich-avatar',
      personaPrompt: 'You are rich.',
      tone: 'formal',
      description: 'A formal avatar.',
    })

    expect(result.tone).toBe('formal')
    expect(result.description).toBe('A formal avatar.')
  })

  it('tone and description are undefined (not null) when absent', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Sparse Avatar',
      slug: 'sparse-avatar',
      personaPrompt: 'Sparse.',
    })

    expect(result.tone).toBeUndefined()
    expect(result.description).toBeUndefined()
  })

  it('findById returns the avatar by its id', async () => {
    const created = await avatarRepo.create({
      scenarioId,
      name: 'Findable Avatar',
      slug: 'findable-avatar',
      personaPrompt: 'Find me.',
    })
    const found = await avatarRepo.findById(created.avatarId)

    expect(found).not.toBeNull()
    expect(found?.avatarId).toBe(created.avatarId)
  })

  it('findById returns null for a non-existent id', async () => {
    const result = await avatarRepo.findById('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })
})
