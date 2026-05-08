import { randomUUID } from 'node:crypto'
import type { IUserMemoryFactRepository } from '../../application/ports/IUserMemoryFactRepository.js'
import type { UserFact } from '../../domain/memory/memory.types.js'

type UpsertFactInput = Omit<UserFact, 'id' | 'createdAt' | 'updatedAt'>

export class InMemoryUserMemoryFactRepository implements IUserMemoryFactRepository {
  private readonly facts: Map<string, UserFact>

  constructor(initialData: UserFact[] = []) {
    this.facts = new Map(initialData.map((fact) => [fact.id, fact]))
  }

  findByUserId(userId: string): Promise<UserFact[]> {
    const facts = [...this.facts.values()]
      .filter((fact) => fact.userId === userId)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    return Promise.resolve(facts)
  }

  upsert(fact: UpsertFactInput): Promise<UserFact> {
    const existing = [...this.facts.values()].find(
      (candidate) =>
        candidate.userId === fact.userId &&
        candidate.category === fact.category &&
        candidate.key === fact.key,
    )
    const now = new Date().toISOString()

    const next: UserFact =
      existing === undefined
        ? {
            id: `umf_${randomUUID()}`,
            userId: fact.userId,
            category: fact.category,
            key: fact.key,
            value: fact.value,
            ...(fact.confidence !== undefined ? { confidence: fact.confidence } : {}),
            createdAt: now,
            updatedAt: now,
          }
        : {
            ...existing,
            value: fact.value,
            ...(fact.confidence !== undefined ? { confidence: fact.confidence } : {}),
            updatedAt: now,
          }

    this.facts.set(next.id, next)
    return Promise.resolve(next)
  }

  deleteById(factId: string): Promise<boolean> {
    return Promise.resolve(this.facts.delete(factId))
  }

  findById(factId: string): Promise<UserFact | null> {
    return Promise.resolve(this.facts.get(factId) ?? null)
  }
}
