import { describe, expect, it } from 'vitest'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { UpdateAvatarUseCase } from './update-avatar.use-case.js'

const baseAvatar = {
  avatarId: 'avatar_1',
  scenarioId: 'scenario_1',
  name: 'Ava',
  status: 'active' as const,
  personaPrompt: 'You are Ava.',
  config: {},
  createdAt: '2026-04-21T08:00:00.000Z',
  updatedAt: '2026-04-21T08:00:00.000Z',
}

describe('UpdateAvatarUseCase', () => {
  it('throws INVALID_INPUT when no fields are provided', async () => {
    const useCase = new UpdateAvatarUseCase(new InMemoryAvatarRepository([baseAvatar]))

    await expect(useCase.execute({ avatarId: 'avatar_1' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('throws NOT_FOUND when avatar does not exist', async () => {
    const useCase = new UpdateAvatarUseCase(new InMemoryAvatarRepository())

    await expect(
      useCase.execute({ avatarId: 'avatar_missing', personaPrompt: 'New prompt' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns updated avatar on happy path', async () => {
    const avatarRepository = new InMemoryAvatarRepository([baseAvatar])
    const useCase = new UpdateAvatarUseCase(avatarRepository)

    const result = await useCase.execute({
      avatarId: 'avatar_1',
      personaPrompt: 'Updated prompt',
      tone: 'formal',
    })

    expect(result.avatar.avatarId).toBe('avatar_1')
    expect(result.avatar.personaPrompt).toBe('Updated prompt')
    expect(result.avatar.tone).toBe('formal')
    expect(result.avatar.name).toBe('Ava')
    expect(result.avatar.updatedAt).not.toBe(baseAvatar.updatedAt)
    expect(result.avatar.computedTraits).toBeNull()
  })

  it('only updates provided fields — other fields remain unchanged', async () => {
    const avatarRepository = new InMemoryAvatarRepository([
      { ...baseAvatar, tone: 'casual', description: 'A helpful avatar' },
    ])
    const useCase = new UpdateAvatarUseCase(avatarRepository)

    const result = await useCase.execute({ avatarId: 'avatar_1', name: 'Ava v2' })

    expect(result.avatar.name).toBe('Ava v2')
    expect(result.avatar.tone).toBe('casual')
    expect(result.avatar.description).toBe('A helpful avatar')
    expect(result.avatar.personaPrompt).toBe('You are Ava.')
  })

  it('surfaces computedTraits as null when not yet prepared, and passes through when set', async () => {
    const traits = {
      identity: ['Guide'],
      personality: ['Warm'],
      speakingStyle: ['Concise'],
      background: ['Former teacher'],
      timeline: ['Joined at story start'],
      currentSituation: ['Welcoming visitors'],
      behaviouralRules: ['No spoilers'],
    }
    const avatarRepository = new InMemoryAvatarRepository([
      { ...baseAvatar, computedTraits: traits },
    ])
    const useCase = new UpdateAvatarUseCase(avatarRepository)

    const result = await useCase.execute({ avatarId: 'avatar_1', name: 'Ava v2' })

    expect(result.avatar.computedTraits).toEqual(traits)
  })
})
