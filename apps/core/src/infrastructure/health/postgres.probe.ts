import type { IDependencyProbe } from '../../application/ports/IDependencyProbe.js'
import type { DependencyProbeResult } from '../../domain/health/index.js'
import type { Sql } from 'postgres'
import { PROBE_TIMEOUT_MS, getErrorMessage, withTimeout } from './probe-utils.js'

export class PostgresProbe implements IDependencyProbe {
  constructor(private readonly sql: Sql) {}

  async probe(): Promise<DependencyProbeResult> {
    const start = Date.now()

    try {
      await withTimeout(this.sql`SELECT 1`, PROBE_TIMEOUT_MS)
      return { name: 'postgres', status: 'healthy', latencyMs: Date.now() - start }
    } catch (error) {
      return {
        name: 'postgres',
        status: 'degraded',
        latencyMs: Date.now() - start,
        message: getErrorMessage(error),
      }
    }
  }
}
