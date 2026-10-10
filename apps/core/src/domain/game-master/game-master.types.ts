import type { UserPersona } from '../user/user.types.js'
import type { RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'
import type {
  ContextMessage,
  GameMasterMemoryContext,
  ShortTermMemoryExchange,
  SelectedEpisodicMemory,
} from '../memory/memory.types.js'

export interface GameMasterState {
  progression: string
  interactionCount: number
  nextTurnOrchestration?: GameMasterOrchestrationState
}

export interface GameMasterInput {
  session: {
    sessionId: string
    turnIndex: number
    activeAvatarId: string
  }
  userMessage: {
    text: string
  }
  state: GameMasterState
  context: {
    experience: {
      scenarioId: string
      language?: string
      description?: string
      goals?: string[]
    }
    conversationState: {
      recentMessages: ContextMessage[]
      recentExchanges: ShortTermMemoryExchange[]
      workingMemory?: GameMasterMemoryContext['workingMemory']
      episodicMemories: SelectedEpisodicMemory[]
    }
    retrievedContext?: {
      avatar_knowledge: RetrievedKnowledgeItem[]
      world: RetrievedKnowledgeItem[]
      media: RetrievedKnowledgeItem[]
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

export type DialogueControlMode =
  'user_led' | 'avatar_guided' | 'avatar_led' | 'repair' | 'transition'

export interface DialogueControl {
  mode: DialogueControlMode
  /** Must be stated explicitly — never inferred from `mode` alone. */
  askFollowUp: boolean
}

export type RetrievalScope = 'avatar_memory' | 'world_context' | 'scenario_knowledge'

/** The GM plans retrieval for a later Avatar turn; it does not perform it. */
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
  /** Compact guidance injected into the next Avatar turn. */
  directorNotes: string
  /** Omitted when routing is not applicable. */
  routing?: RoutingDecision
  progressionUpdate: ProgressionUpdate
}

export type GameMasterStateSummary = {
  progression: string
}

export type GameMasterEvent = {
  type: 'gm_triggered' | 'gm_error'
  severity: 'info' | 'error'
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
