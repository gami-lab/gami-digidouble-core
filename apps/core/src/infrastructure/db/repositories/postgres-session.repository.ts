import type { Sql } from 'postgres'
import type {
  CreateSessionParams,
  ISessionRepository,
  SessionUpdate,
} from '../../../application/ports/ISessionRepository.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

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
    sessionId: `session_${row.id}`,
    userId: row.user_id,
    scenarioId: `scenario_${row.scenario_id}`,
    status: row.status as Session['status'],
    startedAt: row.started_at.toISOString(),
    lastActivityAt: row.last_activity_at.toISOString(),
    ...(row.ended_at !== null ? { endedAt: row.ended_at.toISOString() } : {}),
  }
}

export class PostgresSessionRepository implements ISessionRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateSessionParams): Promise<Session> {
    const scenarioUuid = stripPrefix('scenario_', params.scenarioId)
    const [row] = await this.sql<[SessionRow]>`
      INSERT INTO sessions (user_id, scenario_id)
      VALUES (${params.userId}, ${scenarioUuid})
      RETURNING id, user_id, scenario_id, status, started_at, last_activity_at, ended_at
    `
    return rowToSession(row)
  }

  async findById(sessionId: string): Promise<Session | null> {
    const uuid = extractUuid('session_', sessionId)
    if (uuid === null) return null
    const [row] = await this.sql<[SessionRow?]>`
      SELECT id, user_id, scenario_id, status, started_at, last_activity_at, ended_at
      FROM sessions
      WHERE id = ${uuid}
    `
    return row ? rowToSession(row) : null
  }

  async update(sessionId: string, updates: SessionUpdate): Promise<Session> {
    const uuid = extractUuid('session_', sessionId)
    if (uuid === null) {
      throw new Error(`Session ${sessionId} was not found.`)
    }
    const hasEndedAtUpdate = Object.hasOwn(updates, 'endedAt')
    const endedAtValue = updates.endedAt === undefined ? null : new Date(updates.endedAt)

    const [row] = await this.sql<[SessionRow?]>`
      UPDATE sessions
      SET
        status = COALESCE(${updates.status ?? null}, status),
        last_activity_at = COALESCE(
          ${updates.lastActivityAt === undefined ? null : new Date(updates.lastActivityAt)}::TIMESTAMPTZ,
          last_activity_at
        ),
        ended_at = CASE
          WHEN ${hasEndedAtUpdate}::BOOLEAN THEN ${endedAtValue}::TIMESTAMPTZ
          ELSE ended_at
        END
      WHERE id = ${uuid}
      RETURNING id, user_id, scenario_id, status, started_at, last_activity_at, ended_at
    `

    if (!row) {
      throw new Error(`Session ${sessionId} was not found.`)
    }

    return rowToSession(row)
  }

  async delete(sessionId: string): Promise<void> {
    const uuid = extractUuid('session_', sessionId)
    if (uuid === null) return
    await this.sql`DELETE FROM sessions WHERE id = ${uuid}`
  }
}
