import { describe, expect, it, vi } from 'vitest'
import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { User } from '../../../domain/user/user.types.js'
import { UpsertUserPersonaUseCase } from './upsert-user-persona.use-case.js'

describe('UpsertUserPersonaUseCase', () => {
  it('upserts persona and returns updated user', async () => {
    const user: User = {
      userId: 'user_1',
      persona: { name: 'Maya', roleInWorld: 'student', avatarRelationships: ['Friend of Eva'] },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:01:00.000Z',
    }

    const upsertMock = vi.fn().mockResolvedValue(user)
    const repository: IUserRepository = {
      findById: vi.fn(),
      upsert: upsertMock,
    }
    const useCase = new UpsertUserPersonaUseCase(repository)

    const output = await useCase.execute({
      userId: 'user_1',
      persona: { name: 'Maya', roleInWorld: 'student', avatarRelationships: ['Friend of Eva'] },
    })

    expect(upsertMock).toHaveBeenCalledWith('user_1', {
      name: 'Maya',
      roleInWorld: 'student',
      avatarRelationships: ['Friend of Eva'],
    })
    expect(output).toEqual({ user })
  })

  it('trims userId before repository call', async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      userId: 'user_1',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    })
    const repository: IUserRepository = {
      findById: vi.fn(),
      upsert: upsertMock,
    }
    const useCase = new UpsertUserPersonaUseCase(repository)

    await useCase.execute({ userId: '  user_1  ', persona: {} })

    expect(upsertMock).toHaveBeenCalledWith('user_1', {})
  })

  it('throws when userId is empty after trim', async () => {
    const repository: IUserRepository = {
      findById: vi.fn(),
      upsert: vi.fn(),
    }
    const useCase = new UpsertUserPersonaUseCase(repository)

    await expect(useCase.execute({ userId: '   ', persona: {} })).rejects.toThrow(
      'userId must be a non-empty string.',
    )
  })
})
