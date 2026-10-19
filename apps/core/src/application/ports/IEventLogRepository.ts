export interface IEventLogRepository {
  append(event: StoredEvent): Promise<void>
  /**
   * Appends under a caller-chosen id and returns `false` without writing when an event with that
   * id already exists; the id makes the write idempotent across retries and replays.
   */
  appendOnce(eventId: string, event: StoredEvent): Promise<boolean>
  findBySessionId(sessionId: string, opts?: { limit?: number }): Promise<StoredEvent[]>
}

export type StoredEvent = {
  sessionId?: string
  type: string
  severity: 'info' | 'warning' | 'error'
  correlationId?: string
  requestId?: string
  payload: Record<string, unknown>
  createdAt?: string
}
