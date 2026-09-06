import type { Sql } from 'postgres'
import type {
  CreateSessionParams,
  ISessionRepository,
  ListSessionsFilter,
  SessionUpdate,
} from '../../../application/ports/ISessionRepository.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

interface SessionRow {
  id: string
  user_id: string
  scenario_id: string
  active_avatar_id: string | null
  unlocked_avatar_ids: string[] | null
  model_override: unknown
  avatar_options: unknown
  gm_notes: string | null
  memory_summary: string | null
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
    ...(row.unlocked_avatar_ids !== null
      ? { unlockedAvatarIds: row.unlocked_avatar_ids.map((avatarId) => `avatar_${avatarId}`) }
      : {}),
    ...(row.model_override !== null && row.model_override !== undefined
      ? { modelOverride: row.model_override }
      : {}),
    ...(row.avatar_options !== null && row.avatar_options !== undefined
      ? { avatarOptions: row.avatar_options }
      : {}),
    ...(row.gm_notes !== null ? { gmNotes: row.gm_notes } : {}),
    ...(row.memory_summary !== null ? { memorySummary: row.memory_summary } : {}),
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
    const unlockedAvatarUuids =
      params.unlockedAvatarIds?.map((avatarId) => stripPrefix('avatar_', avatarId)) ?? null
    const [row] = await this.sql<[SessionRow]>`
      INSERT INTO sessions (user_id, scenario_id, active_avatar_id, unlocked_avatar_ids, model_override, avatar_options)
      VALUES (${params.userId}, ${scenarioUuid}, NULL, ${unlockedAvatarUuids}::UUID[], ${this.sql.json(params.modelOverride ?? null)}::JSONB, ${this.sql.json(params.avatarOptions ?? null)}::JSONB)
      RETURNING id, user_id, scenario_id, active_avatar_id, unlocked_avatar_ids, model_override, avatar_options, gm_notes, memory_summary, status, started_at, last_activity_at, ended_at
    `
    return rowToSession(row)
  }

  async findById(sessionId: string): Promise<Session | null> {
    const uuid = extractUuid('session_', sessionId)
    if (uuid === null) return null
    const [row] = await this.sql<[SessionRow?]>`
      SELECT id, user_id, scenario_id, active_avatar_id, unlocked_avatar_ids, model_override, avatar_options, gm_notes, memory_summary, status, started_at, last_activity_at, ended_at
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
    const p = this.buildUpdateParams(updates)

    const [row] = await this.sql<[SessionRow?]>`
      UPDATE sessions
      SET
        status = COALESCE(${updates.status ?? null}, status),
        last_activity_at = COALESCE(
          ${updates.lastActivityAt === undefined ? null : new Date(updates.lastActivityAt)}::TIMESTAMPTZ,
          last_activity_at
        ),
        ended_at = CASE
          WHEN ${p.hasEndedAtUpdate}::BOOLEAN THEN ${p.endedAtValue}::TIMESTAMPTZ
          ELSE ended_at
        END,
        active_avatar_id = CASE
          WHEN ${p.hasActiveAvatarUpdate}::BOOLEAN THEN ${p.activeAvatarUuid}::UUID
          ELSE active_avatar_id
        END,
        unlocked_avatar_ids = CASE
          WHEN ${p.hasUnlockedAvatarIdsUpdate}::BOOLEAN THEN ${p.unlockedAvatarUuids}::UUID[]
          ELSE unlocked_avatar_ids
        END,
        gm_notes = CASE
          WHEN ${p.hasGmNotesUpdate}::BOOLEAN THEN ${p.gmNotesValue}::TEXT
          ELSE gm_notes
        END,
        memory_summary = CASE
          WHEN ${p.hasMemorySummaryUpdate}::BOOLEAN THEN ${p.memorySummaryValue}::TEXT
          ELSE memory_summary
        END
      WHERE id = ${uuid}
      RETURNING id, user_id, scenario_id, active_avatar_id, unlocked_avatar_ids, model_override, avatar_options, gm_notes, memory_summary, status, started_at, last_activity_at, ended_at
    `

    if (!row) {
      throw new Error(`Session ${sessionId} was not found.`)
    }

    return rowToSession(row)
  }

  private buildUpdateParams(updates: SessionUpdate): {
    hasEndedAtUpdate: boolean
    endedAtValue: Date | null
    hasActiveAvatarUpdate: boolean
    activeAvatarUuid: string | null
    hasUnlockedAvatarIdsUpdate: boolean
    unlockedAvatarUuids: string[] | null
    hasGmNotesUpdate: boolean
    gmNotesValue: string | null
    hasMemorySummaryUpdate: boolean
    memorySummaryValue: string | null
  } {
    const hasEndedAtUpdate = Object.hasOwn(updates, 'endedAt')
    const endedAtValue = updates.endedAt === undefined ? null : new Date(updates.endedAt)
    const hasActiveAvatarUpdate = Object.hasOwn(updates, 'activeAvatarId')
    const activeAvatarUuid =
      hasActiveAvatarUpdate &&
      updates.activeAvatarId !== undefined &&
      updates.activeAvatarId !== null
        ? stripPrefix('avatar_', updates.activeAvatarId)
        : null
    const hasUnlockedAvatarIdsUpdate = Object.hasOwn(updates, 'unlockedAvatarIds')
    const unlockedAvatarUuids =
      hasUnlockedAvatarIdsUpdate && updates.unlockedAvatarIds !== undefined
        ? updates.unlockedAvatarIds.map((avatarId) => stripPrefix('avatar_', avatarId))
        : null
    const hasGmNotesUpdate = Object.hasOwn(updates, 'gmNotes')
    const gmNotesValue = updates.gmNotes ?? null
    const hasMemorySummaryUpdate = Object.hasOwn(updates, 'memorySummary')
    const memorySummaryValue = updates.memorySummary ?? null
    return {
      hasEndedAtUpdate,
      endedAtValue,
      hasActiveAvatarUpdate,
      activeAvatarUuid,
      hasUnlockedAvatarIdsUpdate,
      unlockedAvatarUuids,
      hasGmNotesUpdate,
      gmNotesValue,
      hasMemorySummaryUpdate,
      memorySummaryValue,
    }
  }

  async delete(sessionId: string): Promise<void> {
    const uuid = extractUuid('session_', sessionId)
    if (uuid === null) return
    await this.sql`DELETE FROM sessions WHERE id = ${uuid}`
  }

  async list(filter?: ListSessionsFilter): Promise<Session[]> {
    const scenarioUuid =
      filter?.scenarioId !== undefined ? extractUuid('scenario_', filter.scenarioId) : null
    const userId = filter?.userId ?? null
    const status = filter?.status ?? null

    const rows = await this.sql<SessionRow[]>`
      SELECT id, user_id, scenario_id, active_avatar_id, unlocked_avatar_ids, model_override, avatar_options, gm_notes, memory_summary, status, started_at, last_activity_at, ended_at
      FROM sessions
      WHERE (${scenarioUuid}::UUID IS NULL OR scenario_id = ${scenarioUuid}::UUID)
        AND (${userId}::TEXT IS NULL OR user_id = ${userId}::TEXT)
        AND (${status}::TEXT IS NULL OR status = ${status}::TEXT)
      ORDER BY last_activity_at DESC
    `
    return rows.map(rowToSession)
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
