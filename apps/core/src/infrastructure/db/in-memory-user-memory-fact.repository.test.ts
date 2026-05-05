import { describe, expect, it } from 'vitest'
import type { UserFact } from '../../domain/memory/memory.types.js'
import { InMemoryUserMemoryFactRepository } from './in-memory-user-memory-fact.repository.js'

function makeFact(overrides: Partial<UserFact> = {}): UserFact {
  return {
    id: 'umf_1',
    userId: 'user_1',
    category: 'preference',
    key: 'language',
    value: 'en',
    confidence: 0.9,
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-01T08:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryUserMemoryFactRepository', () => {
  it('findByUserId returns empty array for unknown user', async () => {
    const repository = new InMemoryUserMemoryFactRepository()

    await expect(repository.findByUserId('missing')).resolves.toEqual([])
  })

  it('upsert inserts a new fact with id, createdAt, and updatedAt', async () => {
    const repository = new InMemoryUserMemoryFactRepository()

    const created = await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'language',
      value: 'en',
      confidence: 0.7,
    })

    expect(created.id.startsWith('umf_')).toBe(true)
    expect(created.createdAt).toBeTruthy()
    expect(created.updatedAt).toBeTruthy()
  })

  it('upsert with same (userId, category, key) updates existing fact value', async () => {
    const repository = new InMemoryUserMemoryFactRepository()
    const first = await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'language',
      value: 'en',
      confidence: 0.6,
    })
    const second = await repository.upsert({
      userId: 'user_1',
      category: 'preference',
      key: 'language',
      value: 'fr',
      confidence: 0.8,
    })

    expect(second.id).toBe(first.id)
    expect(second.value).toBe('fr')
    expect(second.createdAt).toBe(first.createdAt)
    expect(Date.parse(second.updatedAt)).toBeGreaterThanOrEqual(Date.parse(first.updatedAt))
  })

  it('findByUserId returns all facts for user ordered by newest updatedAt first', async () => {
    const repository = new InMemoryUserMemoryFactRepository([
      makeFact({
        id: 'umf_older',
        updatedAt: '2026-05-01T08:00:00.000Z',
      }),
      makeFact({
        id: 'umf_newer',
        key: 'role',
        updatedAt: '2026-05-02T08:00:00.000Z',
      }),
    ])

    const facts = await repository.findByUserId('user_1')

    expect(facts.map((fact) => fact.id)).toEqual(['umf_newer', 'umf_older'])
  })

  it('deleteById returns true for existing fact and removes it', async () => {
    const fact = makeFact()
    const repository = new InMemoryUserMemoryFactRepository([fact])

    await expect(repository.deleteById(fact.id)).resolves.toBe(true)
    await expect(repository.findById(fact.id)).resolves.toBeNull()
  })

  it('deleteById returns false for unknown id', async () => {
    const repository = new InMemoryUserMemoryFactRepository()

    await expect(repository.deleteById('unknown')).resolves.toBe(false)
  })

  it('findById returns null for unknown id', async () => {
    const repository = new InMemoryUserMemoryFactRepository()

    await expect(repository.findById('unknown')).resolves.toBeNull()
  })

  it('findById returns fact for known id', async () => {
    const fact = makeFact()
    const repository = new InMemoryUserMemoryFactRepository([fact])

    await expect(repository.findById(fact.id)).resolves.toEqual(fact)
  })

  it('cross-user isolation: findByUserId returns only matching user facts', async () => {
    const repository = new InMemoryUserMemoryFactRepository([
      makeFact({ id: 'umf_user_a', userId: 'user_a' }),
      makeFact({ id: 'umf_user_b', userId: 'user_b', key: 'timezone' }),
    ])

    const userAFacts = await repository.findByUserId('user_a')

    expect(userAFacts).toHaveLength(1)
    expect(userAFacts[0]?.id).toBe('umf_user_a')
  })
})
