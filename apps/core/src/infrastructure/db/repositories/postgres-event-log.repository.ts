import { randomUUID } from 'node:crypto'
import type { JSONValue, Sql } from 'postgres'
import type {
  IEventLogRepository,
  StoredEvent,
} from '../../../application/ports/IEventLogRepository.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

type EventLogRow = {
  id: string
  session_id: string | null
  type: string
  severity: StoredEvent['severity']
  correlation_id: string | null
  request_id: string | null
  payload: Record<string, unknown>
  created_at: Date
}

function rowToStoredEvent(row: EventLogRow): StoredEvent {
  return {
    ...(row.session_id !== null ? { sessionId: `session_${row.session_id}` } : {}),
    type: row.type,
    severity: row.severity,
    ...(row.correlation_id !== null ? { correlationId: row.correlation_id } : {}),
    ...(row.request_id !== null ? { requestId: row.request_id } : {}),
    payload: row.payload,
    createdAt: row.created_at.toISOString(),
  }
}

export class PostgresEventLogRepository implements IEventLogRepository {
  constructor(private readonly sql: Sql) {}

  async append(event: StoredEvent): Promise<void> {
    const id = `evt_${randomUUID()}`
    const sessionId =
      event.sessionId !== undefined ? stripPrefix('session_', event.sessionId) : null

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

  async findBySessionId(sessionId: string, opts?: { limit?: number }): Promise<StoredEvent[]> {
    const uuid = extractUuid('session_', sessionId)
    if (uuid === null) return []

    const rows =
      opts?.limit === undefined
        ? await this.sql<EventLogRow[]>`
            SELECT id, session_id, type, severity, correlation_id, request_id, payload, created_at
            FROM event_log
            WHERE session_id = ${uuid}
            ORDER BY created_at DESC
          `
        : await this.sql<EventLogRow[]>`
            SELECT id, session_id, type, severity, correlation_id, request_id, payload, created_at
            FROM event_log
            WHERE session_id = ${uuid}
            ORDER BY created_at DESC
            LIMIT ${opts.limit}
          `

    return rows.map(rowToStoredEvent)
  }
}
