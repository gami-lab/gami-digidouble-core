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
  active_avatar_id: string | null
  gm_notes: string | null
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
    ...(row.active_avatar_id !== null ? { activeAvatarId: `avatar_${row.active_avatar_id}` } : {}),
    ...(row.gm_notes !== null ? { gmNotes: row.gm_notes } : {}),
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
      INSERT INTO sessions (user_id, scenario_id, active_avatar_id)
      VALUES (${params.userId}, ${scenarioUuid}, NULL)
      RETURNING id, user_id, scenario_id, active_avatar_id, gm_notes, status, started_at, last_activity_at, ended_at
    `
    return rowToSession(row)
  }

  async findById(sessionId: string): Promise<Session | null> {
    const uuid = extractUuid('session_', sessionId)
    if (uuid === null) return null
    const [row] = await this.sql<[SessionRow?]>`
      SELECT id, user_id, scenario_id, active_avatar_id, gm_notes, status, started_at, last_activity_at, ended_at
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
    const hasActiveAvatarUpdate = Object.hasOwn(updates, 'activeAvatarId')
    const activeAvatarUuid =
      hasActiveAvatarUpdate && updates.activeAvatarId !== undefined
        ? stripPrefix('avatar_', updates.activeAvatarId)
        : null
    const hasGmNotesUpdate = Object.hasOwn(updates, 'gmNotes')
    const gmNotesValue = updates.gmNotes ?? null

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
        END,
        active_avatar_id = CASE
          WHEN ${hasActiveAvatarUpdate}::BOOLEAN THEN ${activeAvatarUuid}::UUID
          ELSE active_avatar_id
        END,
        gm_notes = CASE
          WHEN ${hasGmNotesUpdate}::BOOLEAN THEN ${gmNotesValue}::TEXT
          ELSE gm_notes
        END
      WHERE id = ${uuid}
      RETURNING id, user_id, scenario_id, active_avatar_id, gm_notes, status, started_at, last_activity_at, ended_at
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

  async countByScenarioId(scenarioId: string): Promise<number> {
    const scenarioUuid = extractUuid('scenario_', scenarioId)
    if (scenarioUuid === null) return 0

    const [row] = await this.sql<Array<{ count: string }>>`
      SELECT COUNT(*)::TEXT AS count
      FROM sessions
      WHERE scenario_id = ${scenarioUuid}
    `
    return Number(row?.count ?? '0')
  }

  async countActiveByScenarioId(scenarioId: string): Promise<number> {
    const scenarioUuid = extractUuid('scenario_', scenarioId)
    if (scenarioUuid === null) return 0

    const [row] = await this.sql<Array<{ count: string }>>`
      SELECT COUNT(*)::TEXT AS count
      FROM sessions
      WHERE scenario_id = ${scenarioUuid}
        AND status = 'active'
    `
    return Number(row?.count ?? '0')
  }
}
