import { describe, expect, it } from 'vitest'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryScenarioRepository } from './in-memory-scenario.repository.js'

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Demo',
    status: 'draft',
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
})
