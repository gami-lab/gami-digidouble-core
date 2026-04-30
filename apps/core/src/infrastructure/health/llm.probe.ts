import type { IDependencyProbe } from '../../application/ports/IDependencyProbe.js'
import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { DependencyProbeResult } from '../../domain/health/index.js'
import { LlmError } from '../llm/llm.error.js'

const PROBE_TIMEOUT_MS = 3_000

export class LlmProbe implements IDependencyProbe {
  constructor(private readonly adapter: ILlmAdapter) {}

  async probe(): Promise<DependencyProbeResult> {
    const start = Date.now()

    try {
      await withTimeout(
        this.adapter.complete({
          systemPrompt: 'ping',
          messages: [{ role: 'user', content: 'ping' }],
          maxTokens: 1,
        }),
        PROBE_TIMEOUT_MS,
      )

      return { name: 'llm', status: 'healthy', latencyMs: Date.now() - start }
    } catch (error) {
      if (error instanceof LlmError) {
        return {
          name: 'llm',
          status: 'degraded',
          latencyMs: Date.now() - start,
          message: error.message,
        }
      }

      return {
        name: 'llm',
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
