export interface IEventLogRepository {
  append(event: StoredEvent): Promise<void>
}

export type StoredEvent = {
  sessionId?: string
  type: string
  severity: 'info' | 'warning' | 'error'
  correlationId?: string
  requestId?: string
  payload: Record<string, unknown>
}
