import type { Sql } from 'postgres'
import type { IUserMemoryFactRepository } from '../../../application/ports/IUserMemoryFactRepository.js'
import type { UserFact } from '../../../domain/memory/memory.types.js'

interface UserMemoryFactRow {
  id: string
  user_id: string
  category: string
  key: string
  value: string
  confidence: number | null
  created_at: Date
  updated_at: Date
}

type UpsertFactInput = Omit<UserFact, 'id' | 'createdAt' | 'updatedAt'>

export class PostgresUserMemoryFactRepository implements IUserMemoryFactRepository {
  constructor(private readonly sql: Sql) {}

  async findByUserId(userId: string): Promise<UserFact[]> {
    const rows = await this.sql<UserMemoryFactRow[]>`
      SELECT id, user_id, category, key, value, confidence, created_at, updated_at
      FROM user_memory_facts
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `
    return rows.map((row) => this.rowToUserFact(row))
  }

  async upsert(fact: UpsertFactInput): Promise<UserFact> {
    const [row] = await this.sql<UserMemoryFactRow[]>`
      INSERT INTO user_memory_facts (user_id, category, key, value, confidence)
      VALUES (${fact.userId}, ${fact.category}, ${fact.key}, ${fact.value}, ${fact.confidence ?? null})
      ON CONFLICT (user_id, category, key)
      DO UPDATE SET
        value = ${fact.value},
        confidence = ${fact.confidence ?? null},
        updated_at = NOW()
      RETURNING id, user_id, category, key, value, confidence, created_at, updated_at
    `
    if (row === undefined) {
      throw new Error(
        `User memory fact upsert failed for userId=${fact.userId}, category=${fact.category}, key=${fact.key}.`,
      )
    }
    return this.rowToUserFact(row)
  }

  async deleteById(factId: string): Promise<boolean> {
    const rows = await this.sql<Array<{ id: string }>>`
      DELETE FROM user_memory_facts
      WHERE id = ${factId}
      RETURNING id
    `
    return rows.length > 0
  }

  async findById(factId: string): Promise<UserFact | null> {
    const [row] = await this.sql<UserMemoryFactRow[]>`
      SELECT id, user_id, category, key, value, confidence, created_at, updated_at
      FROM user_memory_facts
      WHERE id = ${factId}
    `
    return row === undefined ? null : this.rowToUserFact(row)
  }

  private rowToUserFact(row: UserMemoryFactRow): UserFact {
    return {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      key: row.key,
      value: row.value,
      ...(row.confidence !== null ? { confidence: row.confidence } : {}),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  }
}
