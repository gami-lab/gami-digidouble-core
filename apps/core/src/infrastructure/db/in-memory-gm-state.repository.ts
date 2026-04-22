import type { IGmStateRepository } from '../../application/ports/IGmStateRepository.js'
import type { GameMasterState } from '../../domain/game-master/game-master.types.js'

export class InMemoryGmStateRepository implements IGmStateRepository {
  private readonly states: Map<string, GameMasterState>

  constructor(initialData: Array<{ sessionId: string; state: GameMasterState }> = []) {
    this.states = new Map(initialData.map((entry) => [entry.sessionId, entry.state]))
  }

  findBySessionId(sessionId: string): Promise<GameMasterState | null> {
    return Promise.resolve(this.states.get(sessionId) ?? null)
  }

  save(sessionId: string, state: GameMasterState): Promise<void> {
    this.states.set(sessionId, state)
    return Promise.resolve()
  }
}
