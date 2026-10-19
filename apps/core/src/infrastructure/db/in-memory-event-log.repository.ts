import type {
  IEventLogRepository,
  StoredEvent,
} from '../../application/ports/IEventLogRepository.js'

export class InMemoryEventLogRepository implements IEventLogRepository {
  private readonly events: StoredEvent[] = []
  private readonly eventsById = new Map<string, StoredEvent>()

  append(event: StoredEvent): Promise<void> {
    this.events.push({ ...event, createdAt: new Date().toISOString() })
    return Promise.resolve()
  }

  appendOnce(eventId: string, event: StoredEvent): Promise<boolean> {
    if (this.eventsById.has(eventId)) return Promise.resolve(false)
    const stored = { ...event, createdAt: new Date().toISOString() }
    this.eventsById.set(eventId, stored)
    this.events.push(stored)
    return Promise.resolve(true)
  }

  findById(eventId: string): Promise<StoredEvent | null> {
    return Promise.resolve(this.eventsById.get(eventId) ?? null)
  }

  findBySessionId(
    sessionId: string,
    opts?: { limit?: number; type?: string },
  ): Promise<StoredEvent[]> {
    const events = this.events
      .filter((event) => event.sessionId === sessionId)
      .filter((event) => opts?.type === undefined || event.type === opts.type)
      .reverse()
    return Promise.resolve(opts?.limit === undefined ? events : events.slice(0, opts.limit))
  }

  /** For test introspection only — not part of the IEventLogRepository interface. */
  getAll(): StoredEvent[] {
    return [...this.events]
  }
}
