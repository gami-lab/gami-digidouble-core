import type { Message, Session } from '../../../domain/conversation/session.types.js'

export interface GetHistoryInput {
  sessionId: string
}

export type SessionSummary = Pick<
  Session,
  'sessionId' | 'userId' | 'scenarioId' | 'status' | 'startedAt' | 'lastActivityAt' | 'endedAt'
>

export interface GetHistoryOutput {
  session: SessionSummary
  messages: Message[]
}
