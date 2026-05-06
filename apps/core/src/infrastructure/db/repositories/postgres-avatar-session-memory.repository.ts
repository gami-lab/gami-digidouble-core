import type { Sql } from 'postgres'
import type { IAvatarSessionMemoryRepository } from '../../../application/ports/IAvatarSessionMemoryRepository.js'
import type { AvatarSessionMemory } from '../../../domain/memory/memory.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

type AvatarSessionMemoryRow = {
  session_id: string
  avatar_id: string
  summary: string
  updated_at: Date
}

function rowToAvatarSessionMemory(row: AvatarSessionMemoryRow): AvatarSessionMemory {
  return {
    sessionId: `session_${row.session_id}`,
    avatarId: `avatar_${row.avatar_id}`,
    summary: row.summary,
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresAvatarSessionMemoryRepository implements IAvatarSessionMemoryRepository {
  constructor(private readonly sql: Sql) {}

  async findBySessionIdAndAvatarId(
    sessionId: string,
    avatarId: string,
  ): Promise<AvatarSessionMemory | null> {
    const sessionUuid = extractUuid('session_', sessionId)
    const avatarUuid = extractUuid('avatar_', avatarId)
    if (sessionUuid === null || avatarUuid === null) return null

    const [row] = await this.sql<[AvatarSessionMemoryRow?]>`
      SELECT session_id, avatar_id, summary, updated_at
      FROM avatar_session_memories
      WHERE session_id = ${sessionUuid}
        AND avatar_id = ${avatarUuid}
    `

    return row === undefined ? null : rowToAvatarSessionMemory(row)
  }

  async listBySessionId(sessionId: string): Promise<AvatarSessionMemory[]> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return []

    const rows = await this.sql<Array<AvatarSessionMemoryRow>>`
      SELECT session_id, avatar_id, summary, updated_at
      FROM avatar_session_memories
      WHERE session_id = ${sessionUuid}
      ORDER BY updated_at DESC, avatar_id ASC
    `
    return rows.map(rowToAvatarSessionMemory)
  }

  async upsert(memory: Omit<AvatarSessionMemory, 'updatedAt'>): Promise<AvatarSessionMemory> {
    const sessionUuid = stripPrefix('session_', memory.sessionId)
    const avatarUuid = stripPrefix('avatar_', memory.avatarId)

    const [row] = await this.sql<[AvatarSessionMemoryRow?]>`
      INSERT INTO avatar_session_memories (session_id, avatar_id, summary)
      VALUES (${sessionUuid}, ${avatarUuid}, ${memory.summary})
      ON CONFLICT (session_id, avatar_id)
      DO UPDATE SET
        summary = EXCLUDED.summary,
        updated_at = NOW()
      RETURNING session_id, avatar_id, summary, updated_at
    `

    if (row === undefined) {
      throw new Error(
        `Avatar session memory upsert failed for sessionId=${memory.sessionId}, avatarId=${memory.avatarId}.`,
      )
    }

    return rowToAvatarSessionMemory(row)
  }

  async deleteBySessionId(sessionId: string): Promise<number> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return 0

    const rows = await this.sql<Array<{ avatar_id: string }>>`
      DELETE FROM avatar_session_memories
      WHERE session_id = ${sessionUuid}
      RETURNING avatar_id
    `

    return rows.length
  }
}
