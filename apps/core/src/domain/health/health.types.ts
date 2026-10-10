export type HealthStatus = 'healthy' | 'degraded' | 'unknown'

export interface DependencyProbeResult {
  name: string
  status: HealthStatus
  latencyMs?: number
  message?: string
}

export interface HealthReport {
  status: HealthStatus
  dependencies: DependencyProbeResult[]
  checkedAt: string
}
