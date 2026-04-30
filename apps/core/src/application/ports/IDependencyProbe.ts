import type { DependencyProbeResult } from '../../domain/health/index.js'

/**
 * Port: dependency health probe.
 *
 * Implementations live in infrastructure and perform lightweight liveness checks.
 */
export interface IDependencyProbe {
  probe(): Promise<DependencyProbeResult>
}
