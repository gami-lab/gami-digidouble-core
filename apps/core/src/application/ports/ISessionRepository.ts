import type { Session } from '../../domain/conversation/session.types.js'

/** Port: session persistence. Infrastructure must implement this interface. */
export interface ISessionRepository {
  findById(sessionId: string): Promise<Session | null>
  create(params: CreateSessionParams): Promise<Session>
  update(sessionId: string, updates: SessionUpdate): Promise<Session>
  delete(sessionId: string): Promise<void>
  list(filter?: ListSessionsFilter): Promise<Session[]>
  countByScenarioId(scenarioId: string): Promise<number>
  countActiveByScenarioId(scenarioId: string): Promise<number>
}

export type ListSessionsFilter = {
  scenarioId?: string
  userId?: string
  status?: Session['status']
}

export interface CreateSessionParams {
  userId: string
  scenarioId: string
  unlockedAvatarIds?: string[]
}

/** Partial update — only supplied fields will be persisted. */
export type SessionUpdate = {
  status?: Session['status']
  lastActivityAt?: Session['lastActivityAt']
  endedAt?: Session['endedAt']
  /** null clears the active avatar (no avatar currently selected). */
  activeAvatarId?: Session['activeAvatarId'] | null
  unlockedAvatarIds?: Session['unlockedAvatarIds']
  /** null clears persisted gm_notes. */
  gmNotes?: string | null
  /** null clears persisted memory summary. */
  memorySummary?: string | null
}
