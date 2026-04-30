/**
 * Health domain types.
 *
 * Used to represent dependency probe outcomes and aggregate health reports.
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unknown'

export interface DependencyProbeResult {
  /** Human-readable dependency name (e.g. postgres, redis, llm). */
  name: string
  status: HealthStatus
  /** Round-trip latency for the probe call. */
  latencyMs?: number
  /** Optional detail for degraded/unknown states. */
  message?: string
}

export interface HealthReport {
  /** Aggregate status computed by the health use case. */
  status: HealthStatus
  dependencies: DependencyProbeResult[]
  /** ISO 8601 UTC timestamp for when the report was produced. */
  checkedAt: string
}
