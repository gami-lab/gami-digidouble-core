import type { Session } from '../../../domain/conversation/session.types.js'

export interface StartSessionInput {
  userId: string
  scenarioId: string
}

export type SessionSummary = Pick<
  Session,
  'sessionId' | 'userId' | 'scenarioId' | 'status' | 'startedAt' | 'lastActivityAt' | 'endedAt'
>

export interface StartSessionOutput {
  session: SessionSummary
}
