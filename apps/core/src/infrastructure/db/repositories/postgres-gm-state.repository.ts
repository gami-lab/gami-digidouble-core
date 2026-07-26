import type { JSONValue, Sql } from 'postgres'
import type { IGmStateRepository } from '../../../application/ports/IGmStateRepository.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { normalizePersistedOrchestration } from '../../../domain/game-master/gm-state-migration.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

interface GmStateRow {
  session_id: string
  progression: string
  interaction_count: number
  next_turn_orchestration: unknown
  updated_at: Date
}

function rowToGameMasterState(row: GmStateRow): GameMasterState {
  const nextTurnOrchestration = normalizePersistedOrchestration(row.next_turn_orchestration)
  return {
    progression: row.progression,
    interactionCount: row.interaction_count,
    ...(nextTurnOrchestration !== undefined ? { nextTurnOrchestration } : {}),
  }
}

export class PostgresGmStateRepository implements IGmStateRepository {
  constructor(private readonly sql: Sql) {}

  async findBySessionId(sessionId: string): Promise<GameMasterState | null> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return null

    const [row] = await this.sql<[GmStateRow?]>`
      SELECT session_id, progression, interaction_count, next_turn_orchestration, updated_at
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
        progression,
        interaction_count,
        next_turn_orchestration
      )
      VALUES (
        ${sessionUuid},
        ${state.progression},
        ${state.interactionCount},
        ${state.nextTurnOrchestration === undefined ? null : this.sql.json(state.nextTurnOrchestration as unknown as JSONValue)}
      )
      ON CONFLICT (session_id)
      DO UPDATE SET
        progression = EXCLUDED.progression,
        interaction_count = GREATEST(gm_states.interaction_count, EXCLUDED.interaction_count),
        next_turn_orchestration = CASE
          WHEN EXCLUDED.next_turn_orchestration IS NULL THEN gm_states.next_turn_orchestration
          WHEN gm_states.next_turn_orchestration IS NULL THEN EXCLUDED.next_turn_orchestration
          WHEN (gm_states.next_turn_orchestration->>'generatedAfterTurn')::INT >
            (EXCLUDED.next_turn_orchestration->>'generatedAfterTurn')::INT
            THEN gm_states.next_turn_orchestration
          ELSE EXCLUDED.next_turn_orchestration
        END,
        updated_at = NOW()
    `
  }
}
