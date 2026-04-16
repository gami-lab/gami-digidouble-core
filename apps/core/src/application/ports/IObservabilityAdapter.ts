/**
 * Port: observability adapter.
 *
 * All tracing, latency recording, and token accounting go through this
 * interface. Concrete adapter in infrastructure/observability/ wraps Langfuse.
 *
 * Never skip instrumentation — observability is required from day one.
 */
export interface TraceEvent {
  requestId: string
  sessionId?: string
  event: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  metadata?: Record<string, unknown>
}

export interface IObservabilityAdapter {
  trace(event: TraceEvent): Promise<void>
  flush(): Promise<void>
}
