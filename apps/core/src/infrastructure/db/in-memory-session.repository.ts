import type {
  CreateSessionParams,
  ISessionRepository,
  ListSessionsFilter,
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
      ...(params.unlockedAvatarIds !== undefined
        ? { unlockedAvatarIds: [...params.unlockedAvatarIds] }
        : {}),
      status: 'active',
      startedAt: now,
      lastActivityAt: now,
    }
    this.sessions.set(session.sessionId, session)
    return Promise.resolve(session)
  }

  update(sessionId: string, updates: SessionUpdate): Promise<Session> {
    const current = this.sessions.get(sessionId)
    if (current === undefined) {
      throw new Error(`Session ${sessionId} was not found.`)
    }
    const merged = { ...current, ...updates }
    let updated: Session = merged as Session
    if (Object.hasOwn(updates, 'gmNotes') && updates.gmNotes === null) {
      const withoutGmNotes = { ...updated }
      delete (withoutGmNotes as { gmNotes?: string }).gmNotes
      updated = withoutGmNotes as Session
    }
    if (Object.hasOwn(updates, 'memorySummary') && updates.memorySummary === null) {
      const withoutMemorySummary = { ...updated }
      delete (withoutMemorySummary as { memorySummary?: string }).memorySummary
      updated = withoutMemorySummary as Session
    }
    if (Object.hasOwn(updates, 'activeAvatarId') && updates.activeAvatarId === null) {
      const withoutActiveAvatar = { ...updated }
      delete (withoutActiveAvatar as { activeAvatarId?: string }).activeAvatarId
      updated = withoutActiveAvatar as Session
    }
    this.sessions.set(sessionId, updated)
    return Promise.resolve(updated)
  }

  delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    return Promise.resolve()
  }

  list(filter?: ListSessionsFilter): Promise<Session[]> {
    let result = [...this.sessions.values()]
    if (filter?.scenarioId !== undefined) {
      result = result.filter((session) => session.scenarioId === filter.scenarioId)
    }
    if (filter?.userId !== undefined) {
      result = result.filter((session) => session.userId === filter.userId)
    }
    if (filter?.status !== undefined) {
      result = result.filter((session) => session.status === filter.status)
    }
    result.sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt))
    return Promise.resolve(result)
  }

  countByScenarioId(scenarioId: string): Promise<number> {
    const count = [...this.sessions.values()].filter(
      (session) => session.scenarioId === scenarioId,
    ).length
    return Promise.resolve(count)
  }

  countActiveByScenarioId(scenarioId: string): Promise<number> {
    const count = [...this.sessions.values()].filter(
      (session) => session.scenarioId === scenarioId && session.status === 'active',
    ).length
    return Promise.resolve(count)
  }
}
