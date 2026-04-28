import type { GameMasterStateSummary } from '../../../domain/game-master/game-master.types.js'

export interface ListSessionEventsInput {
  sessionId: string
  limit?: number
}

export type SessionEventRecord = {
  type: 'gm_triggered' | 'gm_skipped'
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
    }
    stateAfter?: GameMasterStateSummary
    latencyMs: number
    inputTokens?: number
    outputTokens?: number
  }
}

export interface ListSessionEventsOutput {
  events: SessionEventRecord[]
}
