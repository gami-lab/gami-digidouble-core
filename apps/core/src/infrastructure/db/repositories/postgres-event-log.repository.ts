import { randomUUID } from 'node:crypto'
import type { JSONValue, Sql } from 'postgres'
import type {
  IEventLogRepository,
  StoredEvent,
} from '../../../application/ports/IEventLogRepository.js'

const SESSION_PREFIX = 'session_'

export class PostgresEventLogRepository implements IEventLogRepository {
  constructor(private readonly sql: Sql) {}

  async append(event: StoredEvent): Promise<void> {
    const id = `evt_${randomUUID()}`
    const sessionId = event.sessionId !== undefined ? stripSessionPrefix(event.sessionId) : null

    await this.sql`
      INSERT INTO event_log (id, session_id, type, severity, correlation_id, request_id, payload, created_at)
      VALUES (
        ${id},
        ${sessionId},
        ${event.type},
        ${event.severity},
        ${event.correlationId ?? null},
        ${event.requestId ?? null},
        ${this.sql.json(event.payload as JSONValue)},
        NOW()
      )
    `
  }
}

function stripSessionPrefix(id: string): string {
  return id.startsWith(SESSION_PREFIX) ? id.slice(SESSION_PREFIX.length) : id
}
