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

  it('listByScenarioId returns avatars ordered by createdAt DESC', async () => {
    const repository = new InMemoryAvatarRepository([
      {
        avatarId: 'avatar_old',
        scenarioId: 'scenario_1',
        name: 'Old',
        status: 'active',
        personaPrompt: 'Old',
        config: {},
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      },
      {
        avatarId: 'avatar_new',
        scenarioId: 'scenario_1',
        name: 'New',
        status: 'active',
        personaPrompt: 'New',
        config: {},
        createdAt: '2026-04-21T09:00:00.000Z',
        updatedAt: '2026-04-21T09:00:00.000Z',
      },
    ])

    const result = await repository.listByScenarioId('scenario_1')

    expect(result.map((avatar) => avatar.avatarId)).toEqual(['avatar_new', 'avatar_old'])
  })

  it('delete removes avatar by id', async () => {
    const avatar = makeAvatarConfig()
    const repository = new InMemoryAvatarRepository([avatar])

    await repository.delete(avatar.avatarId)

    await expect(repository.findById(avatar.avatarId)).resolves.toBeNull()
  })

  it('update merges provided fields and refreshes updatedAt', async () => {
    const avatar = makeAvatarConfig()
    const repository = new InMemoryAvatarRepository([avatar])

    const result = await repository.update(avatar.avatarId, {
      personaPrompt: 'Updated prompt',
      tone: 'formal',
    })

    expect(result.personaPrompt).toBe('Updated prompt')
    expect(result.tone).toBe('formal')
    expect(result.name).toBe(avatar.name)
    expect(result.updatedAt).not.toBe(avatar.updatedAt)
  })

  it('update throws NOT_FOUND when avatar does not exist', async () => {
    const repository = new InMemoryAvatarRepository()

    await expect(repository.update('avatar_missing', { name: 'New name' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
