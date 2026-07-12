import { describe, expect, it } from 'vitest'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryScenarioRepository } from './in-memory-scenario.repository.js'

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Demo',
    status: 'draft',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-04-19T10:00:00.000Z',
    updatedAt: '2026-04-19T10:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryScenarioRepository', () => {
  it('create generates scenario_ prefixed ID', async () => {
    const repository = new InMemoryScenarioRepository()

    const created = await repository.create({
      name: 'Demo',
    })

    expect(created.scenarioId.startsWith('scenario_')).toBe(true)
  })

  it('findById returns null for unknown ID', async () => {
    const repository = new InMemoryScenarioRepository()

    const found = await repository.findById('scenario_missing')

    expect(found).toBeNull()
  })

  it('loads initial data from constructor', async () => {
    const seeded = makeScenario({ scenarioId: 'scenario_seeded' })
    const repository = new InMemoryScenarioRepository([seeded])

    const found = await repository.findById('scenario_seeded')

    expect(found).toEqual(seeded)
  })

  it('list returns scenarios ordered by createdAt DESC', async () => {
    const older = makeScenario({
      scenarioId: 'scenario_old',
      createdAt: '2026-04-19T09:00:00.000Z',
      updatedAt: '2026-04-19T09:00:00.000Z',
    })
    const newer = makeScenario({
      scenarioId: 'scenario_new',
      createdAt: '2026-04-19T10:00:00.000Z',
      updatedAt: '2026-04-19T10:00:00.000Z',
    })
    const repository = new InMemoryScenarioRepository([older, newer])

    const listed = await repository.list()

    expect(listed.map((scenario) => scenario.scenarioId)).toEqual(['scenario_new', 'scenario_old'])
  })

  it('delete removes a scenario by id', async () => {
    const repository = new InMemoryScenarioRepository([
      makeScenario({ scenarioId: 'scenario_seeded' }),
    ])

    await repository.delete('scenario_seeded')

    await expect(repository.findById('scenario_seeded')).resolves.toBeNull()
  })

  it('update throws NOT_FOUND for unknown id', async () => {
    const repository = new InMemoryScenarioRepository()

    await expect(repository.update('scenario_missing', { name: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('update merges only supplied fields', async () => {
    const seeded = makeScenario({
      scenarioId: 'scenario_1',
      name: 'Old',
      status: 'draft',
      config: {},
    })
    const repository = new InMemoryScenarioRepository([seeded])

    const updated = await repository.update('scenario_1', { name: 'New' })

    expect(updated.name).toBe('New')
    expect(updated.status).toBe('draft')
    expect(updated.config).toEqual({})
  })

  it('update refreshes updatedAt', async () => {
    const seeded = makeScenario({ scenarioId: 'scenario_1' })
    const repository = new InMemoryScenarioRepository([seeded])

    const updated = await repository.update('scenario_1', { status: 'active' })

    expect(updated.updatedAt).not.toBe(seeded.updatedAt)
  })

  it('keeps modelSelection separate from config and supports explicit clearing', async () => {
    const repository = new InMemoryScenarioRepository()

    const created = await repository.create({
      name: 'Runtime-configured',
      modelSelection: {
        defaultProfile: { provider: 'openai', model: 'gpt-4o' },
        gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      },
    })
    expect(created.modelSelection).toEqual({
      defaultProfile: { provider: 'openai', model: 'gpt-4o' },
      gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    })
    expect(created.config).toEqual({})

    const cleared = await repository.update(created.scenarioId, { modelSelection: null })
    expect(cleared.modelSelection).toBeUndefined()
    expect(cleared.config).toEqual({})
  })
})
