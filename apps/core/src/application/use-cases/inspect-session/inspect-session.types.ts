import type { SessionSummary } from '@gami/shared'
import type { Conversation } from '../../../domain/conversation/session.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'

export interface InspectSessionInput {
  sessionId: string
}

export type { SessionSummary }

export type InspectGmState = Pick<
  GameMasterState,
  'currentAvatarId' | 'progression' | 'topicsCovered' | 'interactionCount'
>

export type InspectTransitionRecord = {
  fromAvatarId: string | null
  toAvatarId: string
  reason: string | null
  startedBy: Conversation['startedBy'] | null
  transitionedAt: string
}

export interface InspectSessionOutput {
  inspect: {
    session: SessionSummary
    gmState: InspectGmState | null
    transitionHistory: InspectTransitionRecord[]
    unlockedAvatarIds: string[]
    gmNotes: string | null
  }
}
