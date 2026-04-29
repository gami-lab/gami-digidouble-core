import type { GameMasterStateSummary } from '../../../domain/game-master/game-master.types.js'

export interface ListSessionEventsInput {
  sessionId: string
  limit?: number
}

export type SessionEventRecord = {
  type: 'gm_triggered' | 'gm_error'
  correlationId: string
  createdAt: string
  payload: {
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
  }
}

export interface ListSessionEventsOutput {
  events: SessionEventRecord[]
}
