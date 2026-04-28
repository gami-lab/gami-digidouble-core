import type { Session } from '../../../domain/conversation/session.types.js'

export interface ResetSessionInput {
  sessionId: string
}

export interface ResetSessionOutput {
  session: Session
}
