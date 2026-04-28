import type { Session } from '../../../domain/conversation/session.types.js'

export interface ListSessionsInput {
  scenarioId?: string
  userId?: string
  status?: Session['status']
}

export interface ListSessionsOutput {
  sessions: Session[]
}
