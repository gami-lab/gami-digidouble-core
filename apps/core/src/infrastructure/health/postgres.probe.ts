import type { IDependencyProbe } from '../../application/ports/IDependencyProbe.js'
import type { DependencyProbeResult } from '../../domain/health/index.js'
import type { Sql } from 'postgres'

const PROBE_TIMEOUT_MS = 3_000

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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error('probe timed out'))
      }, timeoutMs)
    }),
  ])
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
