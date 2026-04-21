import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

let scenarioId = ''
let avatarRepo: PostgresAvatarRepository

function defineCreateAndReadTests(): void {
  it('creates an avatar and returns it with generated id and timestamps', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Test Avatar',
      personaPrompt: 'You are a test avatar.',
    })

    expect(result.avatarId).toBeTypeOf('string')
    expect(result.scenarioId).toBe(scenarioId)
    expect(result.name).toBe('Test Avatar')
    expect(result.status).toBe('active')
    expect(result.personaPrompt).toBe('You are a test avatar.')
    expect(result.createdAt).toBeTypeOf('string')
    expect(result.updatedAt).toBeTypeOf('string')
  })

  it('creates an avatar with optional fields', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Rich Avatar',
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
      personaPrompt: 'Sparse.',
    })

    expect(result.tone).toBeUndefined()
    expect(result.description).toBeUndefined()
  })

  it('persists and returns adjustments', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Adjusted Avatar',
      personaPrompt: 'You are adjusted.',
      adjustments: ['Be concise.', 'Use bullet points.'],
    })

    expect(result.adjustments).toEqual(['Be concise.', 'Use bullet points.'])

    const found = await avatarRepo.findById(result.avatarId)
    expect(found?.adjustments).toEqual(['Be concise.', 'Use bullet points.'])
  })

  it('adjustments are undefined when not provided', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Plain Avatar',
      personaPrompt: 'No adjustments.',
    })

    expect(result.adjustments).toBeUndefined()

    const found = await avatarRepo.findById(result.avatarId)
    expect(found?.adjustments).toBeUndefined()
  })

  it('findById returns the avatar by its id', async () => {
    const created = await avatarRepo.create({
      scenarioId,
      name: 'Findable Avatar',
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
}

function defineListAndDeleteTests(): void {
  it('listByScenarioId returns avatars ordered by created_at DESC', async () => {
    const older = await avatarRepo.create({
      scenarioId,
      name: 'Old',
      personaPrompt: 'Old prompt',
    })
    const newer = await avatarRepo.create({
      scenarioId,
      name: 'New',
      personaPrompt: 'New prompt',
    })

    const listed = await avatarRepo.listByScenarioId(scenarioId)

    expect(listed.map((avatar) => avatar.avatarId)).toEqual([newer.avatarId, older.avatarId])
  })

  it('delete removes an existing avatar', async () => {
    const created = await avatarRepo.create({
      scenarioId,
      name: 'Disposable',
      personaPrompt: 'Disposable prompt',
    })

    await avatarRepo.delete(created.avatarId)
    const found = await avatarRepo.findById(created.avatarId)

    expect(found).toBeNull()
  })
}

describe.skipIf(!DB_AVAILABLE)('PostgresAvatarRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository

  beforeAll(async () => {
    sql = await createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    avatarRepo = new PostgresAvatarRepository(sql)
  })

  beforeEach(async () => {
    const scenario = await scenarioRepo.create({
      name: 'Harness',
    })
    scenarioId = scenario.scenarioId
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  defineCreateAndReadTests()
  defineListAndDeleteTests()
})
