import type { IUserRepository } from '../../application/ports/IUserRepository.js'
import type { User, UserPersona } from '../../domain/user/user.types.js'

export class InMemoryUserRepository implements IUserRepository {
  private readonly users: Map<string, User>

  constructor(initialData: User[] = []) {
    this.users = new Map(initialData.map((user) => [user.userId, user]))
  }

  findById(userId: string): Promise<User | null> {
    return Promise.resolve(this.users.get(userId) ?? null)
  }

  upsert(userId: string, persona: UserPersona): Promise<User> {
    const existing = this.users.get(userId)
    const now = new Date().toISOString()
    const user: User =
      existing === undefined
        ? {
            userId,
            persona: { ...persona },
            createdAt: now,
            updatedAt: now,
          }
        : {
            ...existing,
            persona: { ...persona },
            updatedAt: now,
          }
    this.users.set(userId, user)
    return Promise.resolve(user)
  }
}
