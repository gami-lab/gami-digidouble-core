import type { Sql } from 'postgres'
import type {
  CreateSessionParams,
  ISessionRepository,
  SessionUpdate,
} from '../../../application/ports/ISessionRepository.js'
import type { Session } from '../../../domain/conversation/session.types.js'

interface SessionRow {
  id: string
  user_id: string
  scenario_id: string
  status: string
  started_at: Date
  last_activity_at: Date
  ended_at: Date | null
}

function rowToSession(row: SessionRow): Session {
  return {
    sessionId: row.id,
    userId: row.user_id,
    scenarioId: row.scenario_id,
    status: row.status as Session['status'],
    startedAt: row.started_at.toISOString(),
    lastActivityAt: row.last_activity_at.toISOString(),
    ...(row.ended_at !== null ? { endedAt: row.ended_at.toISOString() } : {}),
  }
}

export class PostgresSessionRepository implements ISessionRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateSessionParams): Promise<Session> {
    const [row] = await this.sql<[SessionRow]>`
      INSERT INTO sessions (user_id, scenario_id)
      VALUES (${params.userId}, ${params.scenarioId})
      RETURNING id, user_id, scenario_id, status, started_at, last_activity_at, ended_at
    `
    return rowToSession(row)
  }

  async findById(sessionId: string): Promise<Session | null> {
    const [row] = await this.sql<[SessionRow?]>`
      SELECT id, user_id, scenario_id, status, started_at, last_activity_at, ended_at
      FROM sessions
      WHERE id = ${sessionId}
    `
    return row ? rowToSession(row) : null
  }

  async update(sessionId: string, updates: SessionUpdate): Promise<Session> {
    const endedAtValue =
      updates.endedAt === undefined || updates.endedAt === null ? null : new Date(updates.endedAt)

    const [row] = await this.sql<[SessionRow?]>`
      UPDATE sessions
      SET
        status = COALESCE(${updates.status ?? null}, status),
        last_activity_at = COALESCE(
          ${updates.lastActivityAt === undefined ? null : new Date(updates.lastActivityAt)}::TIMESTAMPTZ,
          last_activity_at
        ),
        ended_at = COALESCE(${endedAtValue}::TIMESTAMPTZ, ended_at)
      WHERE id = ${sessionId}
      RETURNING id, user_id, scenario_id, status, started_at, last_activity_at, ended_at
    `

    if (!row) {
      throw new Error(`Session ${sessionId} was not found.`)
    }

    return rowToSession(row)
  }

  async delete(sessionId: string): Promise<void> {
    await this.sql`DELETE FROM sessions WHERE id = ${sessionId}`
  }
}
