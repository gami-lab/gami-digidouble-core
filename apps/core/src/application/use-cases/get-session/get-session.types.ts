import type { Session } from '../../../domain/conversation/session.types.js'

export interface GetSessionInput {
  sessionId: string
}

export type SessionSummary = Pick<
  Session,
  | 'sessionId'
  | 'userId'
  | 'scenarioId'
  | 'activeAvatarId'
  | 'unlockedAvatarIds'
  | 'status'
  | 'startedAt'
  | 'lastActivityAt'
  | 'endedAt'
>

export interface GetSessionOutput {
  session: SessionSummary
}
