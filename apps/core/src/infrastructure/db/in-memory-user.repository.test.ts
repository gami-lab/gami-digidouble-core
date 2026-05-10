import { describe, expect, it } from 'vitest'
import type { User } from '../../domain/user/user.types.js'
import { InMemoryUserRepository } from './in-memory-user.repository.js'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'user_1',
    persona: {
      name: 'Maya',
      roleInWorld: 'student',
      avatarRelationships: ['Friend of Eva'],
    },
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-01T08:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryUserRepository', () => {
  it('findById returns null when user does not exist', async () => {
    const repository = new InMemoryUserRepository()

    await expect(repository.findById('missing')).resolves.toBeNull()
  })

  it('findById returns user when found', async () => {
    const user = makeUser()
    const repository = new InMemoryUserRepository([user])

    await expect(repository.findById(user.userId)).resolves.toEqual(user)
  })

  it('upsert creates and then updates persona for an existing user', async () => {
    const repository = new InMemoryUserRepository()

    const created = await repository.upsert('user_1', {
      name: 'Sam',
      roleInWorld: 'mentor',
      avatarRelationships: ['Friend of Ava'],
    })
    const updated = await repository.upsert('user_1', {
      name: 'Lina',
      roleInWorld: 'architect',
      dialogGuidance: 'Be direct and concise',
    })

    expect(created.userId).toBe('user_1')
    expect(created.createdAt).toBeTruthy()
    expect(created.updatedAt).toBeTruthy()
    expect(updated.userId).toBe('user_1')
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt >= created.updatedAt).toBe(true)
    expect(updated.persona).toEqual({
      name: 'Lina',
      roleInWorld: 'architect',
      dialogGuidance: 'Be direct and concise',
    })
  })
})
