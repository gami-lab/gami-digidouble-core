/**
 * Game Master domain types.
 *
 * The GM is a lightweight async director — it observes conversations and
 * injects guidance when needed. It never blocks the Avatar's response.
 *
 * Source of truth: docs/GAME_MASTER_CONTRACT.md
 */

/** Minimal state maintained by the Game Master across turns. */
export interface GameMasterState {
  currentAvatarId?: string
  /** Textual description of where the user is in the experience. */
  progression: string
  /** Topics already covered — used to avoid repetition. */
  topicsCovered: string[]
  interactionCount: number
}

/** Input provided to the GM on each background evaluation. */
export interface GameMasterInput {
  session: {
    sessionId: string
    turnIndex: number
  }
  userMessage: {
    text: string
  }
  state: GameMasterState
  context: {
    experience: {
      scenarioId: string
      description?: string
    }
    availableAvatars: Array<{
      avatarId: string
      name: string
      description?: string
    }>
  }
}

/** Decision output produced by the GM. */
export interface GameMasterOutput {
  avatarId: string
  conversationMode: 'new' | 'continue'
  context?: {
    /** Freeform guidance note injected into the Avatar's next context. */
    notes?: string
  }
  stateUpdate: {
    progression?: 'none' | 'increase'
    topicCovered?: string
    /** Always 1 — increment applied by the state reducer. */
    interactionIncrement: 1
  }
}
