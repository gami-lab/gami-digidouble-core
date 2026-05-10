import { describe, expect, it, vi } from 'vitest'
import type { IUserRepository } from '../../ports/IUserRepository.js'
import { GetUserPersonaUseCase } from './get-user-persona.use-case.js'

describe('GetUserPersonaUseCase', () => {
  it('returns persona when user exists with persona', async () => {
    const repository: IUserRepository = {
      findById: vi.fn().mockResolvedValue({
        userId: 'user_1',
        persona: { name: 'Maya', roleInWorld: 'student' },
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      }),
      upsert: vi.fn(),
    }
    const useCase = new GetUserPersonaUseCase(repository)

    const output = await useCase.execute({ userId: 'user_1' })
    expect(output).toEqual({ persona: { name: 'Maya', roleInWorld: 'student' } })
  })

  it('returns null persona when user exists without persona', async () => {
    const repository: IUserRepository = {
      findById: vi.fn().mockResolvedValue({
        userId: 'user_1',
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      }),
      upsert: vi.fn(),
    }
    const useCase = new GetUserPersonaUseCase(repository)

    const output = await useCase.execute({ userId: 'user_1' })
    expect(output).toEqual({ persona: null })
  })

  it('returns null persona when user does not exist', async () => {
    const repository: IUserRepository = {
      findById: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    }
    const useCase = new GetUserPersonaUseCase(repository)

    const output = await useCase.execute({ userId: 'unknown' })
    expect(output).toEqual({ persona: null })
  })
})
