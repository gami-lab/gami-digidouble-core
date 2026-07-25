import type { IGmStateRepository } from '../../application/ports/IGmStateRepository.js'
import type { GameMasterState } from '../../domain/game-master/game-master.types.js'

export class InMemoryGmStateRepository implements IGmStateRepository {
  private readonly states: Map<string, GameMasterState>

  constructor(initialData: Array<{ sessionId: string; state: GameMasterState }> = []) {
    this.states = new Map(
      initialData.map((entry) => [entry.sessionId, structuredClone(entry.state)]),
    )
  }

  findBySessionId(sessionId: string): Promise<GameMasterState | null> {
    const state = this.states.get(sessionId)
    return Promise.resolve(state === undefined ? null : structuredClone(state))
  }

  save(sessionId: string, state: GameMasterState): Promise<void> {
    this.states.set(sessionId, structuredClone(state))
    return Promise.resolve()
  }
}
