import type {
  IEventLogRepository,
  StoredEvent,
} from '../../application/ports/IEventLogRepository.js'

export class InMemoryEventLogRepository implements IEventLogRepository {
  private readonly events: StoredEvent[] = []
  private readonly eventIds = new Set<string>()

  append(event: StoredEvent): Promise<void> {
    this.events.push({ ...event, createdAt: new Date().toISOString() })
    return Promise.resolve()
  }

  async appendOnce(eventId: string, event: StoredEvent): Promise<boolean> {
    if (this.eventIds.has(eventId)) return false
    this.eventIds.add(eventId)
    await this.append(event)
    return true
  }

  findBySessionId(sessionId: string, opts?: { limit?: number }): Promise<StoredEvent[]> {
    const events = this.events.filter((event) => event.sessionId === sessionId).reverse()
    return Promise.resolve(opts?.limit === undefined ? events : events.slice(0, opts.limit))
  }

  /** For test introspection only — not part of the IEventLogRepository interface. */
  getAll(): StoredEvent[] {
    return [...this.events]
  }
}
