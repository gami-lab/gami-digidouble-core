import type { IDependencyProbe } from '../../application/ports/IDependencyProbe.js'
import type { DependencyProbeResult } from '../../domain/health/index.js'
import type { Redis } from 'ioredis'

const PROBE_TIMEOUT_MS = 3_000

export class RedisProbe implements IDependencyProbe {
  constructor(private readonly client: Redis) {}

  async probe(): Promise<DependencyProbeResult> {
    const start = Date.now()

    try {
      const response = await withTimeout<string>(this.client.ping(), PROBE_TIMEOUT_MS)
      if (response !== 'PONG') {
        return {
          name: 'redis',
          status: 'degraded',
          latencyMs: Date.now() - start,
          message: `Unexpected ping response: ${response}`,
        }
      }

      return { name: 'redis', status: 'healthy', latencyMs: Date.now() - start }
    } catch (error) {
      return {
        name: 'redis',
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
