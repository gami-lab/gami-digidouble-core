export interface IEventLogRepository {
  append(event: StoredEvent): Promise<void>
  // Phase B: findBySessionId(sessionId: string, opts?: { limit?: number }): Promise<StoredEvent[]>
  // Required for GET /v1/admin/sessions/{sessionId}/events (see GAME_MASTER_CONTRACT.md §14).
}

export type StoredEvent = {
  sessionId?: string
  type: string
  severity: 'info' | 'warning' | 'error'
  correlationId?: string
  requestId?: string
  payload: Record<string, unknown>
}
