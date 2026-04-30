import type { GameMasterStateSummary } from '../../../domain/game-master/game-master.types.js'

export interface ListSessionEventsInput {
  sessionId: string
  limit?: number
}

export type SessionEventRecord = {
  type: 'gm_triggered' | 'gm_error' | 'turn_completed'
  correlationId: string
  createdAt: string
  payload: GmSessionEventPayload | TurnCompletedEventPayload
}

export type GmSessionEventPayload = {
  triggerReason: string | null
  turnIndex: number
  interactionCount: number
  stateBefore: GameMasterStateSummary
  decision?: {
    avatarId: string
    conversationMode: 'new' | 'continue'
    notesInjected: boolean
    directiveCount: number
    unlockedAvatarIds?: string[]
    suggestedAvatarId?: string
    suggestedAvatarReason?: string
    switchedAvatarId?: string
  }
  stateAfter?: GameMasterStateSummary
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
  errorCode?: string
  correlationId?: string
}

export type TurnCompletedEventPayload = {
  conversationId: string
  turnIndex: number
  avatarId: string
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  hasGm: boolean
  correlationId?: string
}

export interface ListSessionEventsOutput {
  events: SessionEventRecord[]
}
