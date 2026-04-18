import type {
  CreateSessionParams,
  ISessionRepository,
  SessionUpdate,
} from '../../application/ports/ISessionRepository.js'
import type { Session } from '../../domain/conversation/session.types.js'

/**
 * In-memory session repository for tests and local deterministic flows.
 */
export class InMemorySessionRepository implements ISessionRepository {
  private readonly sessions: Map<string, Session>

  constructor(initialData: Session[] = []) {
    this.sessions = new Map(initialData.map((session) => [session.sessionId, session]))
  }

  findById(sessionId: string): Promise<Session | null> {
    return Promise.resolve(this.sessions.get(sessionId) ?? null)
  }

  create(params: CreateSessionParams): Promise<Session> {
    const now = new Date().toISOString()
    const session: Session = {
      sessionId: `session_${crypto.randomUUID()}`,
      userId: params.userId,
      scenarioId: params.scenarioId,
      status: 'active',
      startedAt: now,
      lastActivityAt: now,
      endedAt: null,
    }
    this.sessions.set(session.sessionId, session)
    return Promise.resolve(session)
  }

  update(sessionId: string, updates: SessionUpdate): Promise<Session> {
    const current = this.sessions.get(sessionId)
    if (current === undefined) {
      throw new Error(`Session ${sessionId} was not found.`)
    }
    const updated: Session = { ...current, ...updates }
    this.sessions.set(sessionId, updated)
    return Promise.resolve(updated)
  }

  delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    return Promise.resolve()
  }
}
