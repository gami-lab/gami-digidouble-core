import { describe, expect, it } from 'vitest'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { ListScenarioAvatarsUseCase } from './list-scenario-avatars.use-case.js'

describe('ListScenarioAvatarsUseCase', () => {
  it('returns 404 when scenario is missing', async () => {
    const useCase = new ListScenarioAvatarsUseCase(
      new InMemoryScenarioRepository(),
      new InMemoryAvatarRepository(),
    )

    await expect(useCase.execute({ scenarioId: 'scenario_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('returns avatars ordered by createdAt DESC', async () => {
    const scenarioRepository = new InMemoryScenarioRepository([
      {
        scenarioId: 'scenario_1',
        name: 'Scenario',
        status: 'active',
        config: {},
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      },
    ])
    const avatarRepository = new InMemoryAvatarRepository([
      {
        avatarId: 'avatar_old',
        scenarioId: 'scenario_1',
        name: 'Old',
        status: 'active',
        personaPrompt: 'Old prompt',
        config: {},
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      },
      {
        avatarId: 'avatar_new',
        scenarioId: 'scenario_1',
        name: 'New',
        status: 'active',
        personaPrompt: 'New prompt',
        config: {},
        createdAt: '2026-04-21T09:00:00.000Z',
        updatedAt: '2026-04-21T09:00:00.000Z',
      },
    ])
    const useCase = new ListScenarioAvatarsUseCase(scenarioRepository, avatarRepository)

    const result = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(result.avatars.map((avatar) => avatar.avatarId)).toEqual(['avatar_new', 'avatar_old'])
    expect(result.avatars[0]?.config).toEqual({})
  })
})
