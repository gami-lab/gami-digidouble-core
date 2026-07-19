import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AvatarComputedTraits } from '../../../domain/avatar/avatar.types.js'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

const sampleTraits: AvatarComputedTraits = {
  identity: ['A warm onboarding guide.'],
  personality: ['Curious', 'Patient'],
  speakingStyle: ['Short sentences.'],
  background: ['Former teacher.'],
  timeline: ['Joined the world at story start.'],
  currentSituation: ['Welcoming new visitors.'],
  behaviouralRules: ['Never reveals plot twists early.'],
}

function defineCreateAndReadTests(
  getRepo: () => PostgresAvatarRepository,
  getScenarioId: () => string,
): void {
  it('creates an avatar and returns it with generated id and timestamps', async () => {
    const result = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Test Avatar',
      personaPrompt: 'You are a test avatar.',
    })

    expect(result.avatarId).toBeTypeOf('string')
    expect(result.scenarioId).toBe(getScenarioId())
    expect(result.name).toBe('Test Avatar')
    expect(result.status).toBe('active')
    expect(result.personaPrompt).toBe('You are a test avatar.')
    expect(result.createdAt).toBeTypeOf('string')
    expect(result.updatedAt).toBeTypeOf('string')
  })

  it('creates an avatar with optional fields', async () => {
    const result = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Rich Avatar',
      personaPrompt: 'You are rich.',
      tone: 'formal',
      description: 'A formal avatar.',
    })

    expect(result.tone).toBe('formal')
    expect(result.description).toBe('A formal avatar.')
  })

  it('tone and description are undefined (not null) when absent', async () => {
    const result = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Sparse Avatar',
      personaPrompt: 'Sparse.',
    })

    expect(result.tone).toBeUndefined()
    expect(result.description).toBeUndefined()
  })

  it('persists and returns adjustments', async () => {
    const result = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Adjusted Avatar',
      personaPrompt: 'You are adjusted.',
      adjustments: ['Be concise.', 'Use bullet points.'],
    })

    expect(result.adjustments).toEqual(['Be concise.', 'Use bullet points.'])

    const found = await getRepo().findById(result.avatarId)
    expect(found?.adjustments).toEqual(['Be concise.', 'Use bullet points.'])
  })

  it('adjustments are undefined when not provided', async () => {
    const result = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Plain Avatar',
      personaPrompt: 'No adjustments.',
    })

    expect(result.adjustments).toBeUndefined()

    const found = await getRepo().findById(result.avatarId)
    expect(found?.adjustments).toBeUndefined()
  })

  it('findById returns the avatar by its id', async () => {
    const created = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Findable Avatar',
      personaPrompt: 'Find me.',
    })
    const found = await getRepo().findById(created.avatarId)

    expect(found).not.toBeNull()
    expect(found?.avatarId).toBe(created.avatarId)
  })

  it('findById returns null for a non-existent id', async () => {
    const result = await getRepo().findById('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })
}

function defineComputedTraitsTests(
  getRepo: () => PostgresAvatarRepository,
  getScenarioId: () => string,
): void {
  it('is undefined until preparation has run', async () => {
    const result = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Unprepared Avatar',
      personaPrompt: 'Not yet prepared.',
    })

    expect(result.computedTraits).toBeUndefined()

    const found = await getRepo().findById(result.avatarId)
    expect(found?.computedTraits).toBeUndefined()
  })

  it('saveComputedTraits stores and round-trips traits without touching author fields', async () => {
    const created = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Preparable Avatar',
      personaPrompt: 'Original prompt.',
      description: 'Original description.',
    })

    const saved = await getRepo().saveComputedTraits(created.avatarId, sampleTraits)

    expect(saved.computedTraits).toEqual(sampleTraits)
    expect(saved.personaPrompt).toBe('Original prompt.')
    expect(saved.description).toBe('Original description.')

    const found = await getRepo().findById(created.avatarId)
    expect(found?.computedTraits).toEqual(sampleTraits)
  })

  it('saveComputedTraits clears traits when passed null', async () => {
    const created = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Clearable Avatar',
      personaPrompt: 'Prompt.',
    })
    await getRepo().saveComputedTraits(created.avatarId, sampleTraits)

    const cleared = await getRepo().saveComputedTraits(created.avatarId, null)

    expect(cleared.computedTraits).toBeUndefined()
  })

  it('a second saveComputedTraits call overwrites the first, still leaving author fields untouched', async () => {
    const created = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Recomputed Avatar',
      personaPrompt: 'Original prompt.',
      description: 'Original description.',
    })
    const regeneratedTraits: AvatarComputedTraits = { ...sampleTraits, identity: ['Regenerated'] }

    await getRepo().saveComputedTraits(created.avatarId, sampleTraits)
    const result = await getRepo().saveComputedTraits(created.avatarId, regeneratedTraits)

    expect(result.computedTraits).toEqual(regeneratedTraits)
    expect(result.personaPrompt).toBe('Original prompt.')
    expect(result.description).toBe('Original description.')

    const found = await getRepo().findById(created.avatarId)
    expect(found?.computedTraits).toEqual(regeneratedTraits)
  })
}

function defineListAndDeleteTests(
  getRepo: () => PostgresAvatarRepository,
  getScenarioId: () => string,
): void {
  it('listByScenarioId returns avatars ordered by created_at DESC', async () => {
    const older = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Old',
      personaPrompt: 'Old prompt',
    })
    const newer = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'New',
      personaPrompt: 'New prompt',
    })

    const listed = await getRepo().listByScenarioId(getScenarioId())

    expect(listed.map((avatar) => avatar.avatarId)).toEqual([newer.avatarId, older.avatarId])
  })

  it('delete removes an existing avatar', async () => {
    const created = await getRepo().create({
      scenarioId: getScenarioId(),
      name: 'Disposable',
      personaPrompt: 'Disposable prompt',
    })

    await getRepo().delete(created.avatarId)
    const found = await getRepo().findById(created.avatarId)

    expect(found).toBeNull()
  })
}

describe.skipIf(!DB_AVAILABLE)('PostgresAvatarRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let scenarioId: string
  let avatarRepo: PostgresAvatarRepository

  beforeAll(() => {
    sql = createTestSql()
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

  defineCreateAndReadTests(
    () => avatarRepo,
    () => scenarioId,
  )
  defineListAndDeleteTests(
    () => avatarRepo,
    () => scenarioId,
  )
  describe('computedTraits', () => {
    defineComputedTraitsTests(
      () => avatarRepo,
      () => scenarioId,
    )

    it('normalizes malformed persisted computed_traits into the canonical seven-field shape', async () => {
      const created = await avatarRepo.create({
        scenarioId,
        name: 'Malformed Traits Avatar',
        personaPrompt: 'Prompt.',
      })

      await sql`
        UPDATE avatars
        SET computed_traits = ${sql.json({
          identity: ['Valid identity', 42, null],
          personality: 'not-an-array',
          extraField: ['discarded'],
        })}
        WHERE id = ${created.avatarId.replace('avatar_', '')}
      `

      const found = await avatarRepo.findById(created.avatarId)

      expect(found?.computedTraits).toEqual({
        identity: ['Valid identity'],
        personality: [],
        speakingStyle: [],
        background: [],
        timeline: [],
        currentSituation: [],
        behaviouralRules: [],
      })
    })
  })
})
