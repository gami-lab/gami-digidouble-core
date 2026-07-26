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
    const current = this.states.get(sessionId)
    const currentOrchestration = current?.nextTurnOrchestration
    const incomingOrchestration = state.nextTurnOrchestration
    const nextTurnOrchestration =
      incomingOrchestration === undefined
        ? currentOrchestration
        : currentOrchestration !== undefined &&
            currentOrchestration.generatedAfterTurn > incomingOrchestration.generatedAfterTurn
          ? currentOrchestration
          : incomingOrchestration

    this.states.set(
      sessionId,
      structuredClone({
        ...state,
        interactionCount: Math.max(current?.interactionCount ?? 0, state.interactionCount),
        ...(nextTurnOrchestration !== undefined ? { nextTurnOrchestration } : {}),
      }),
    )
    return Promise.resolve()
  }
}
