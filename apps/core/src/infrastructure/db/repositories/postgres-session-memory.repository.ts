import type { Sql } from 'postgres'
import type { ISessionMemoryRepository } from '../../../application/ports/ISessionMemoryRepository.js'
import type { SessionMemory } from '../../../domain/memory/memory.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

type SessionMemoryRow = {
  session_id: string
  summary: string
  updated_at: Date
}

function rowToSessionMemory(row: SessionMemoryRow): SessionMemory {
  return {
    sessionId: `session_${row.session_id}`,
    summary: row.summary,
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresSessionMemoryRepository implements ISessionMemoryRepository {
  constructor(private readonly sql: Sql) {}

  async findBySessionId(sessionId: string): Promise<SessionMemory | null> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return null

    const [row] = await this.sql<[SessionMemoryRow?]>`
      SELECT session_id, summary, updated_at
      FROM session_memories
      WHERE session_id = ${sessionUuid}
    `

    return row === undefined ? null : rowToSessionMemory(row)
  }

  async upsert(memory: Omit<SessionMemory, 'updatedAt'>): Promise<SessionMemory> {
    const sessionUuid = stripPrefix('session_', memory.sessionId)

    const [row] = await this.sql<[SessionMemoryRow?]>`
      INSERT INTO session_memories (session_id, summary)
      VALUES (${sessionUuid}, ${memory.summary})
      ON CONFLICT (session_id)
      DO UPDATE SET
        summary = EXCLUDED.summary,
        updated_at = NOW()
      RETURNING session_id, summary, updated_at
    `

    if (row === undefined) {
      throw new Error(`Session memory upsert failed for sessionId=${memory.sessionId}.`)
    }

    return rowToSessionMemory(row)
  }

  async deleteBySessionId(sessionId: string): Promise<boolean> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return false

    const rows = await this.sql<Array<{ session_id: string }>>`
      DELETE FROM session_memories
      WHERE session_id = ${sessionUuid}
      RETURNING session_id
    `

    return rows.length > 0
  }
}
