import type { RuntimeEvent } from '@gami/shared'

export type SessionEventHandler = (event: RuntimeEvent) => void

export interface ISessionEventPublisher {
  /**
   * Emit a runtime event for a session.
   * All subscribers for that session receive the event synchronously in-process.
   */
  emit(event: RuntimeEvent): void

  /**
   * Returns true when a background GM run is currently executing for this session.
   * Set to true at processing_started, cleared at processing_finished or on error.
   */
  isProcessing(sessionId: string): boolean

  /**
   * Mark processing status for a session.
   */
  setProcessing(sessionId: string, value: boolean): void

  /**
   * Subscribe to all runtime events for a given session.
   * Returns an unsubscribe function. The caller MUST call it when done (e.g. on SSE disconnect).
   */
  subscribe(sessionId: string, handler: SessionEventHandler): () => void

  /**
   * Retrieve the most recent event emitted for a session, if any.
   * Used to populate `pendingEvent` in runtime state snapshots.
   */
  getLastEvent(sessionId: string): RuntimeEvent | undefined
}
