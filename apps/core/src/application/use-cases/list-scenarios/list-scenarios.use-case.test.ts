import { describe, expect, it } from 'vitest'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { ListScenariosUseCase } from './list-scenarios.use-case.js'

function makeScenario(overrides: Partial<Scenario>): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'draft',
    config: {},
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
    ...overrides,
  }
}

describe('ListScenariosUseCase', () => {
  it('returns scenarios ordered by createdAt DESC', async () => {
    const repository = new InMemoryScenarioRepository([
      makeScenario({
        scenarioId: 'scenario_old',
        name: 'Old',
        createdAt: '2026-04-21T09:00:00.000Z',
        updatedAt: '2026-04-21T09:00:00.000Z',
      }),
      makeScenario({
        scenarioId: 'scenario_new',
        name: 'New',
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z',
      }),
    ])
    const useCase = new ListScenariosUseCase(repository)

    const result = await useCase.execute()

    expect(result.scenarios.map((scenario) => scenario.scenarioId)).toEqual([
      'scenario_new',
      'scenario_old',
    ])
    expect(result.scenarios[0]?.config).toEqual({})
  })
})
