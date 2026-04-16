import type { Session } from '../../domain/conversation/session.types.js'

/** Port: session persistence. Infrastructure must implement this interface. */
export interface ISessionRepository {
  findById(sessionId: string): Promise<Session | null>
  create(params: CreateSessionParams): Promise<Session>
  update(sessionId: string, updates: SessionUpdate): Promise<Session>
  delete(sessionId: string): Promise<void>
}

export interface CreateSessionParams {
  userId: string
  scenarioId: string
}

/** Partial update — only supplied fields will be persisted. */
export type SessionUpdate = Partial<Pick<Session, 'status' | 'lastActivityAt' | 'endedAt'>>
