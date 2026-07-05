import { describe, expect, it } from 'vitest'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { GetScenarioUseCase } from './get-scenario.use-case.js'

describe('GetScenarioUseCase', () => {
  it('returns 404 when scenario is missing', async () => {
    const useCase = new GetScenarioUseCase(new InMemoryScenarioRepository())

    await expect(useCase.execute({ scenarioId: 'scenario_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('returns the scenario when it exists', async () => {
    const scenarioRepository = new InMemoryScenarioRepository([
      {
        scenarioId: 'scenario_1',
        name: 'Scenario',
        status: 'active',
        objectives: [],
        worldContext: '',
        avatarAvailability: { initialAvatarIds: [] },
        config: {},
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      },
    ])
    const useCase = new GetScenarioUseCase(scenarioRepository)

    const result = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(result.scenario).toMatchObject({ scenarioId: 'scenario_1', name: 'Scenario' })
  })
})
