import { describe, expect, it } from 'vitest'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { GetAvailableAvatarsUseCase } from './get-available-avatars.use-case.js'

describe('GetAvailableAvatarsUseCase', () => {
  it('returns NOT_FOUND when session does not exist', async () => {
    const useCase = new GetAvailableAvatarsUseCase(
      new InMemorySessionRepository(),
      new InMemoryAvatarRepository(),
    )

    await expect(useCase.execute({ sessionId: 'session_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('returns currentAvatarId and avatars from the session scenario only', async () => {
    const useCase = new GetAvailableAvatarsUseCase(
      new InMemorySessionRepository([
        {
          sessionId: 'session_1',
          userId: 'user_1',
          scenarioId: 'scenario_1',
          activeAvatarId: 'avatar_2',
          status: 'active',
          startedAt: '2026-04-23T10:00:00.000Z',
          lastActivityAt: '2026-04-23T10:01:00.000Z',
        },
      ]),
      new InMemoryAvatarRepository([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'A',
          status: 'active',
          personaPrompt: 'A',
          config: {},
          createdAt: '2026-04-23T10:00:00.000Z',
          updatedAt: '2026-04-23T10:00:00.000Z',
        },
        {
          avatarId: 'avatar_2',
          scenarioId: 'scenario_1',
          name: 'B',
          status: 'active',
          personaPrompt: 'B',
          config: {},
          createdAt: '2026-04-23T10:01:00.000Z',
          updatedAt: '2026-04-23T10:01:00.000Z',
        },
        {
          avatarId: 'avatar_other',
          scenarioId: 'scenario_2',
          name: 'Other',
          status: 'active',
          personaPrompt: 'Other',
          config: {},
          createdAt: '2026-04-23T10:02:00.000Z',
          updatedAt: '2026-04-23T10:02:00.000Z',
        },
      ]),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.sessionId).toBe('session_1')
    expect(output.currentAvatarId).toBe('avatar_2')
    expect(output.avatars.map((avatar) => avatar.avatarId)).toEqual(['avatar_2', 'avatar_1'])
  })

  it('returns null currentAvatarId when session active avatar is not set', async () => {
    const useCase = new GetAvailableAvatarsUseCase(
      new InMemorySessionRepository([
        {
          sessionId: 'session_1',
          userId: 'user_1',
          scenarioId: 'scenario_1',
          status: 'active',
          startedAt: '2026-04-23T10:00:00.000Z',
          lastActivityAt: '2026-04-23T10:01:00.000Z',
        },
      ]),
      new InMemoryAvatarRepository([]),
    )

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.currentAvatarId).toBeNull()
    expect(output.avatars).toEqual([])
  })
})
