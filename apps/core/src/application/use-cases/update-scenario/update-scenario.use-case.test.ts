import { describe, expect, it } from 'vitest'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { UpdateScenarioUseCase } from './update-scenario.use-case.js'

const seedScenario = {
  scenarioId: 'scenario_1',
  name: 'Original Name',
  status: 'draft' as const,
  objectives: [],
  worldContext: '',
  avatarAvailability: { initialAvatarIds: [] },
  config: {},
  createdAt: '2026-04-21T08:00:00.000Z',
  updatedAt: '2026-04-21T08:00:00.000Z',
}

describe('UpdateScenarioUseCase', () => {
  it('throws INVALID_INPUT when no updatable fields are provided', async () => {
    const useCase = new UpdateScenarioUseCase(new InMemoryScenarioRepository([seedScenario]))

    await expect(useCase.execute({ scenarioId: 'scenario_1' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('throws NOT_FOUND when scenario does not exist', async () => {
    const useCase = new UpdateScenarioUseCase(new InMemoryScenarioRepository())

    await expect(
      useCase.execute({ scenarioId: 'scenario_missing', name: 'New Name' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('updates only the provided fields', async () => {
    const repo = new InMemoryScenarioRepository([seedScenario])
    const useCase = new UpdateScenarioUseCase(repo)

    const output = await useCase.execute({ scenarioId: 'scenario_1', name: 'Updated Name' })

    expect(output.scenario.name).toBe('Updated Name')
    expect(output.scenario.status).toBe('draft')
    expect(output.scenario.config).toEqual({})
  })

  it('updates status without affecting other fields', async () => {
    const repo = new InMemoryScenarioRepository([seedScenario])
    const useCase = new UpdateScenarioUseCase(repo)

    const output = await useCase.execute({ scenarioId: 'scenario_1', status: 'active' })

    expect(output.scenario.name).toBe('Original Name')
    expect(output.scenario.status).toBe('active')
  })

  it('updates config without clearing it when not provided', async () => {
    const repo = new InMemoryScenarioRepository([seedScenario])
    const useCase = new UpdateScenarioUseCase(repo)

    const output = await useCase.execute({
      scenarioId: 'scenario_1',
      config: { newKey: 'newValue' },
    })

    expect(output.scenario.config).toEqual({ newKey: 'newValue' })
    expect(output.scenario.name).toBe('Original Name')
  })

  it('refreshes updatedAt on update', async () => {
    const repo = new InMemoryScenarioRepository([seedScenario])
    const useCase = new UpdateScenarioUseCase(repo)

    const output = await useCase.execute({ scenarioId: 'scenario_1', name: 'New' })

    expect(output.scenario.updatedAt).not.toBe(seedScenario.updatedAt)
  })
})
