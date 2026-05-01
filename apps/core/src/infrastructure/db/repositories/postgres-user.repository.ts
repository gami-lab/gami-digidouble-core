import type { JSONValue, Sql } from 'postgres'
import type { IUserRepository } from '../../../application/ports/IUserRepository.js'
import type { User, UserPersona } from '../../../domain/user/user.types.js'

interface UserRow {
  id: string
  persona: UserPersona | null
  created_at: Date
  updated_at: Date
}

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly sql: Sql) {}

  async findById(userId: string): Promise<User | null> {
    const [row] = await this.sql<UserRow[]>`
      SELECT id, persona, created_at, updated_at
      FROM users
      WHERE id = ${userId}
    `
    return row === undefined ? null : this.toUser(row)
  }

  async upsert(userId: string, persona: UserPersona): Promise<User> {
    const [row] = await this.sql<UserRow[]>`
      INSERT INTO users (id, persona)
      VALUES (${userId}, ${this.sql.json(persona as JSONValue)})
      ON CONFLICT (id)
      DO UPDATE SET
        persona = ${this.sql.json(persona as JSONValue)},
        updated_at = NOW()
      RETURNING id, persona, created_at, updated_at
    `
    if (row === undefined) {
      throw new Error(`User ${userId} upsert failed.`)
    }
    return this.toUser(row)
  }

  private toUser(row: UserRow): User {
    return {
      userId: row.id,
      ...(row.persona !== null ? { persona: row.persona } : {}),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  }
}
