import type { UserPersona } from '../user/user.types.js'
import type { ContextMessage, GameMasterMemoryContext } from '../memory/memory.types.js'

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
  recentMessages?: ContextMessage[]
  state: GameMasterState
  context: {
    experience: {
      scenarioId: string
      description?: string
      goals?: string[]
    }
    memory?: GameMasterMemoryContext
    userPersona?: UserPersona
    availableAvatars: Array<{
      avatarId: string
      name: string
      description?: string
      scope?: string
      availability?: 'available' | 'locked'
    }>
  }
}

/** Decision output produced by the GM. */
export interface GameMasterOutput {
  avatarId: string
  nextAvatarId?: string
  transitionReason?: string
  recommendedChoices?: Array<{
    id: string
    label: string
  }>
  contentTrigger?: string
  unlockAvatarIds?: string[]
  unlockDecisions?: Array<{
    avatarId: string
    reason: string
  }>
  suggestedAvatarId?: string
  suggestedAvatarReason?: string
  conversationMode: 'new' | 'continue'
  context?: {
    /** Freeform guidance note injected into the Avatar's next context. */
    notes?: string
  }
  stateUpdate: {
    progression?: 'none' | 'increase'
    topicCovered?: string
    activeAvatarId?: string
    /** Always 1 — increment applied by the state reducer. */
    interactionIncrement: 1
  }
}

/** Snapshot of GM state fields included in diagnostic event payloads. */
export type GameMasterStateSummary = {
  currentAvatarId?: string
  progression: string
  topicsCovered: string[]
}

/** Structured diagnostic event emitted by the GM after every post-turn run. */
export type GameMasterEvent = {
  type: 'gm_triggered' | 'gm_error'
  severity: 'info' | 'error'
  /** Shared with the originating user turn. */
  correlationId: string
  requestId?: string
  payload: {
    triggerReason: 'session_start' | 'post_turn_observation' | 'manual' | null
    turnIndex: number
    interactionCount: number
    stateBefore: GameMasterStateSummary
    decision?: {
      avatarId: string
      conversationMode: 'new' | 'continue'
      notesInjected: boolean
      directiveCount: number
      unlockedAvatarIds?: string[]
      unlockEvaluations?: Array<{
        avatarId: string
        avatarName: string
        reason?: string
        outcome: 'unlocked' | 'already_unlocked' | 'rejected_not_mentioned'
      }>
      suggestedAvatarId?: string
      suggestedAvatarReason?: string
      switchedAvatarId?: string
    }
    stateAfter?: GameMasterStateSummary
    latencyMs: number
    totalLatencyMs?: number
    inputTokens?: number
    outputTokens?: number
  }
}
