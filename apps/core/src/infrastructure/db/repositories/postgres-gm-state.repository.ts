import type { Sql } from 'postgres'
import type { IGmStateRepository } from '../../../application/ports/IGmStateRepository.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

interface GmStateRow {
  session_id: string
  current_avatar_id: string | null
  progression: string
  topics_covered: string[]
  interaction_count: number
  updated_at: Date
}

function rowToGameMasterState(row: GmStateRow): GameMasterState {
  return {
    ...(row.current_avatar_id !== null ? { currentAvatarId: row.current_avatar_id } : {}),
    progression: row.progression,
    topicsCovered: row.topics_covered,
    interactionCount: row.interaction_count,
  }
}

export class PostgresGmStateRepository implements IGmStateRepository {
  constructor(private readonly sql: Sql) {}

  async findBySessionId(sessionId: string): Promise<GameMasterState | null> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return null

    const [row] = await this.sql<[GmStateRow?]>`
      SELECT session_id, current_avatar_id, progression, topics_covered, interaction_count, updated_at
      FROM gm_states
      WHERE session_id = ${sessionUuid}
    `
    return row ? rowToGameMasterState(row) : null
  }

  async save(sessionId: string, state: GameMasterState): Promise<void> {
    const sessionUuid = stripPrefix('session_', sessionId)
    await this.sql`
      INSERT INTO gm_states (
        session_id,
        current_avatar_id,
        progression,
        topics_covered,
        interaction_count
      )
      VALUES (
        ${sessionUuid},
        ${state.currentAvatarId ?? null},
        ${state.progression},
        ${state.topicsCovered},
        ${state.interactionCount}
      )
      ON CONFLICT (session_id)
      DO UPDATE SET
        current_avatar_id = EXCLUDED.current_avatar_id,
        progression = EXCLUDED.progression,
        topics_covered = EXCLUDED.topics_covered,
        interaction_count = EXCLUDED.interaction_count,
        updated_at = NOW()
    `
  }
}
