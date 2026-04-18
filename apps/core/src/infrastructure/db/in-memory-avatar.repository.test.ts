import { describe, expect, it } from 'vitest'
import { makeAvatarConfig } from '../../domain/avatar/avatar.fixtures.js'
import { InMemoryAvatarRepository } from './in-memory-avatar.repository.js'

describe('InMemoryAvatarRepository', () => {
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
