import type { GameMasterState } from '../../domain/game-master/game-master.types.js'

export interface IGmStateRepository {
  /** Load the GM state for a session. Returns null if not yet initialised. */
  findBySessionId(sessionId: string): Promise<GameMasterState | null>
  /** Persist (upsert) the GM state for a session. */
  save(sessionId: string, state: GameMasterState): Promise<void>
}
