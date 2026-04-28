export interface IEventLogRepository {
  append(event: StoredEvent): Promise<void>
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
