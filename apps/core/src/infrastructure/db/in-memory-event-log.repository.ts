import type {
  IEventLogRepository,
  StoredEvent,
} from '../../application/ports/IEventLogRepository.js'

export class InMemoryEventLogRepository implements IEventLogRepository {
  private readonly events: StoredEvent[] = []

  append(event: StoredEvent): Promise<void> {
    this.events.push(event)
    return Promise.resolve()
  }

  /** For test introspection only — not part of the IEventLogRepository interface. */
  getAll(): StoredEvent[] {
    return [...this.events]
  }
}
