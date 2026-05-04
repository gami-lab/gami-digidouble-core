import type { SessionSummary, SessionTransitionRecord } from '@gami/shared'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'

export interface InspectSessionInput {
  sessionId: string
}

export type { SessionSummary }

export type InspectGmState = Pick<
  GameMasterState,
  'currentAvatarId' | 'progression' | 'topicsCovered' | 'interactionCount'
>

export type InspectTransitionRecord = SessionTransitionRecord

export interface InspectSessionOutput {
  inspect: {
    session: SessionSummary
    gmState: InspectGmState | null
    transitionHistory: InspectTransitionRecord[]
    unlockedAvatarIds: string[]
    gmNotes: string | null
  }
}
