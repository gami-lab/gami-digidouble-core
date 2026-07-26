import type { UserPersona } from '../user/user.types.js'
import type { ContextMessage, GameMasterMemoryContext } from '../memory/memory.types.js'

/**
 * Game Master domain types.
 *
 * The GM is a lightweight async director — it observes conversations and
 * injects guidance when needed. It never blocks the Avatar's response.
 *
 * Source of truth: docs/GAME_MASTER_CONTRACT.md
 *
 * Ownership:
 * - Static system instructions: gm-prompt.service.ts
 * - Dynamic LLM input rendering: gm-input-renderer.ts
 * - Runtime contract types: this file
 * - Output parsing/normalization guards: gm-output-parser.ts and
 *   gm-output-normalization.ts
 */

/** Minimal state maintained by the Game Master across turns. */
export interface GameMasterState {
  /** Textual description of where the user is in the experience. */
  progression: string
  /**
   * Retained for schema/API compatibility only. Covered-topic tracking is now
   * owned exclusively by memory compaction (`ConversationWorkingMemory.coveredTopics`);
   * the GM no longer reports or appends to this field.
   */
  /** Legacy persisted field; never read for orchestration and never written by GM logic. */
  topicsCovered?: string[]
  interactionCount: number
  /** Latest unconsumed GM result for the next Avatar turn. */
  nextTurnOrchestration?: GameMasterOrchestrationState
}

/** Input provided to the GM on each background evaluation. */
export interface GameMasterInput {
  session: {
    sessionId: string
    turnIndex: number
    activeAvatarId: string
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
    rag?: {
      memory?: Array<{ sourceId: string; excerpt: string }>
      world?: Array<{ sourceId: string; excerpt: string }>
      media?: Array<{ sourceId: string; excerpt: string }>
    }
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

/** How the next Avatar turn should be led. */
export type DialogueControlMode =
  | 'user_led'
  | 'avatar_guided'
  | 'avatar_led'
  | 'repair'
  | 'transition'

export interface DialogueControl {
  mode: DialogueControlMode
  /** Must be stated explicitly — never inferred from `mode` alone. */
  askFollowUp: boolean
}

export type RetrievalScope = 'avatar_memory' | 'world_context' | 'scenario_knowledge'

/**
 * Retrieval the GM wants prepared for the next related Avatar turn.
 * The GM does not perform retrieval itself; it only plans it.
 */
export interface RetrievalPlan {
  required: boolean
  queries?: string[]
  requiredFacts?: string[]
  scopes?: RetrievalScope[]
}

export type RoutingAction = 'stay' | 'suggest' | 'switch' | 'unlock' | 'unlock_and_switch'

export interface RoutingDecision {
  action: RoutingAction
  /** Not required for `stay`; required for `suggest`/`switch`/`unlock_and_switch`. */
  avatarId?: string
  reason?: string
  /** Multiple unlock targets for `unlock`/`unlock_and_switch`. */
  unlockDecisions?: Array<{
    avatarId: string
    reason: string
  }>
}

export type ProgressionState = 'none' | 'increase'

export interface ProgressionUpdate {
  progression: ProgressionState
  objectiveId?: string
  reason?: string
}

/** GM output retained for exactly the next relevant Avatar turn. */
export interface GameMasterOrchestrationState {
  generatedByCorrelationId?: string
  activeAvatarId: string
  generatedAfterTurn: number
  generatedAt: string
  dialogueControl: DialogueControl
  retrievalPlan: RetrievalPlan
  directorNotes?: string
  routing?: RoutingDecision
  progressionUpdate: ProgressionUpdate
  consumedAfterTurn?: number
  consumedAt?: string
}

/** Decision output produced by the GM. */
export interface GameMasterOutput {
  dialogueControl: DialogueControl
  retrievalPlan: RetrievalPlan
  /** Compact narrative guidance for the next Avatar turn. */
  directorNotes: string
  /** Omitted entirely when routing is not applicable (e.g. a single-Avatar scenario). */
  routing?: RoutingDecision
  progressionUpdate: ProgressionUpdate
}

/** Snapshot of GM state fields included in diagnostic event payloads. */
export type GameMasterStateSummary = {
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
      dialogueMode: DialogueControlMode
      askFollowUp: boolean
      notesInjected: boolean
      injectedNote?: string
      retrievalRequired: boolean
      retrievalPlan?: {
        required: boolean
        queries: string[]
        requiredFacts: string[]
      }
      routingAction?: RoutingAction
      routingAvatarId?: string
      routingReason?: string
      unlockedAvatarIds?: string[]
      unlockEvaluations?: Array<{
        avatarId: string
        avatarName: string
        reason?: string
        outcome: 'unlocked' | 'already_unlocked' | 'rejected_not_mentioned'
      }>
      switchedAvatarId?: string
      progression: ProgressionState
      objectiveId?: string
    }
    stateAfter?: GameMasterStateSummary
    latencyMs: number
    totalLatencyMs?: number
    inputTokens?: number
    outputTokens?: number
  }
}
