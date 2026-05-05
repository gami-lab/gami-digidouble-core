import type { UserFact } from '../../domain/memory/memory.types.js'

export interface IUserMemoryFactRepository {
  /** Find all facts for a user, ordered by updatedAt DESC. */
  findByUserId(userId: string): Promise<UserFact[]>

  /** Upsert a fact: if a row with same (userId, category, key) exists, update it. Otherwise insert. */
  upsert(fact: Omit<UserFact, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserFact>

  /** Delete one fact by ID. Returns true if a row was deleted, false if not found. */
  deleteById(factId: string): Promise<boolean>

  /** Check if a fact belongs to a given user. Used before delete to prevent cross-user deletion. */
  findById(factId: string): Promise<UserFact | null>
}
