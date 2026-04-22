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
  | 'status'
  | 'startedAt'
  | 'lastActivityAt'
  | 'endedAt'
>

export interface GetSessionOutput {
  session: SessionSummary
}
