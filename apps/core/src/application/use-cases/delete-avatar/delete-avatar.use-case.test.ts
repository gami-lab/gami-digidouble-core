import { describe, expect, it } from 'vitest'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { DeleteAvatarUseCase } from './delete-avatar.use-case.js'

describe('DeleteAvatarUseCase', () => {
  it('returns 404 when avatar is missing', async () => {
    const useCase = new DeleteAvatarUseCase(
      new InMemoryAvatarRepository(),
      new InMemorySessionRepository(),
    )

    await expect(useCase.execute({ avatarId: 'avatar_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('returns 409 when scenario has active sessions', async () => {
    const useCase = new DeleteAvatarUseCase(
      new InMemoryAvatarRepository([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Ava',
          status: 'active',
          personaPrompt: 'You are Ava.',
          config: {},
          createdAt: '2026-04-21T08:00:00.000Z',
          updatedAt: '2026-04-21T08:00:00.000Z',
        },
      ]),
      new InMemorySessionRepository([
        {
          sessionId: 'session_1',
          userId: 'user_1',
          scenarioId: 'scenario_1',
          status: 'active',
          startedAt: '2026-04-21T08:00:00.000Z',
          lastActivityAt: '2026-04-21T08:00:00.000Z',
        },
      ]),
    )

    await expect(useCase.execute({ avatarId: 'avatar_1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('deletes avatar when scenario has no active sessions', async () => {
    const avatarRepository = new InMemoryAvatarRepository([
      {
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        name: 'Ava',
        status: 'active',
        personaPrompt: 'You are Ava.',
        config: {},
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      },
    ])
    const useCase = new DeleteAvatarUseCase(avatarRepository, new InMemorySessionRepository())

    const result = await useCase.execute({ avatarId: 'avatar_1' })

    expect(result).toEqual({ avatarId: 'avatar_1', deleted: true })
    await expect(avatarRepository.findById('avatar_1')).resolves.toBeNull()
  })
})
