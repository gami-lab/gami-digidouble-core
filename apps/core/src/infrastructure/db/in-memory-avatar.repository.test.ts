import { describe, expect, it } from 'vitest'
import { makeAvatarConfig } from '../../domain/avatar/avatar.fixtures.js'
import { InMemoryAvatarRepository } from './in-memory-avatar.repository.js'

describe('InMemoryAvatarRepository', () => {
  it('create stores and returns avatar config with generated avatarId', async () => {
    const repository = new InMemoryAvatarRepository()

    const created = await repository.create({
      scenarioId: 'scenario-1',
      name: 'Ava',
      personaPrompt: 'You are Ava.',
      adjustments: ['Use short answers.'],
    })

    expect(created.avatarId.startsWith('avatar_')).toBe(true)
    expect(created.scenarioId).toBe('scenario-1')
    expect(created.status).toBe('active')
    expect(created.adjustments).toEqual(['Use short answers.'])

    const loaded = await repository.findById(created.avatarId)
    expect(loaded).toEqual(created)
  })

  it('findById returns avatar config when avatar exists', async () => {
    const avatar = makeAvatarConfig()
    const repository = new InMemoryAvatarRepository([avatar])

    const result = await repository.findById(avatar.avatarId)

    expect(result).toEqual(avatar)
  })

  it('findById returns null when avatar does not exist', async () => {
    const repository = new InMemoryAvatarRepository([makeAvatarConfig()])

    const result = await repository.findById('unknown-avatar-id')

    expect(result).toBeNull()
  })
})
