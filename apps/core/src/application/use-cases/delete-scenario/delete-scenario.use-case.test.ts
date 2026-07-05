import { describe, expect, it } from 'vitest'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { DeleteScenarioUseCase } from './delete-scenario.use-case.js'

describe('DeleteScenarioUseCase', () => {
  it('returns 404 when scenario is missing', async () => {
    const useCase = new DeleteScenarioUseCase(
      new InMemoryScenarioRepository(),
      new InMemoryAvatarRepository(),
      new InMemorySessionRepository(),
    )

    await expect(useCase.execute({ scenarioId: 'scenario_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('returns 409 when scenario still has avatars', async () => {
    const useCase = new DeleteScenarioUseCase(
      new InMemoryScenarioRepository([
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
      ]),
      new InMemoryAvatarRepository([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Ava',
          status: 'active',
          personaPrompt: 'You are Ava.',
          config: {},
          createdAt: '2026-04-21T08:10:00.000Z',
          updatedAt: '2026-04-21T08:10:00.000Z',
        },
      ]),
      new InMemorySessionRepository(),
    )

    await expect(useCase.execute({ scenarioId: 'scenario_1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('returns 409 when scenario still has sessions', async () => {
    const useCase = new DeleteScenarioUseCase(
      new InMemoryScenarioRepository([
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
      ]),
      new InMemoryAvatarRepository(),
      new InMemorySessionRepository([
        {
          sessionId: 'session_1',
          userId: 'user_1',
          scenarioId: 'scenario_1',
          status: 'closed',
          startedAt: '2026-04-21T08:00:00.000Z',
          lastActivityAt: '2026-04-21T08:00:00.000Z',
          endedAt: '2026-04-21T08:30:00.000Z',
        },
      ]),
    )

    await expect(useCase.execute({ scenarioId: 'scenario_1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('deletes scenario when it has no avatars and no sessions', async () => {
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
    const useCase = new DeleteScenarioUseCase(
      scenarioRepository,
      new InMemoryAvatarRepository(),
      new InMemorySessionRepository(),
    )

    const result = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(result).toEqual({ scenarioId: 'scenario_1', deleted: true })
    await expect(scenarioRepository.findById('scenario_1')).resolves.toBeNull()
  })
})
