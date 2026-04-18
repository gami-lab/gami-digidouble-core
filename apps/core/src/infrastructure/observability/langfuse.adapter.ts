import { Langfuse } from 'langfuse'
import type {
  IObservabilityAdapter,
  TraceEvent,
} from '../../application/ports/IObservabilityAdapter.js'

/**
 * Langfuse-backed observability adapter.
 * Records each trace event as a Langfuse generation capturing latency,
 * token counts, cost, and arbitrary metadata.
 *
 * Errors from the Langfuse SDK are caught and logged to stderr — observability
 * must never crash or delay the main application flow.
 */
export class LangfuseObservabilityAdapter implements IObservabilityAdapter {
  private readonly client: Langfuse
  private flushed = false

  constructor(publicKey: string, secretKey: string, host: string) {
    this.client = new Langfuse({ publicKey, secretKey, baseUrl: host })
  }

  trace(event: TraceEvent): Promise<void> {
    try {
      const trace = this.client.trace({
        id: event.requestId,
        name: event.event,
        ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
        ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
      })

      trace.generation({
        name: event.event,
        startTime: new Date(Date.now() - (event.latencyMs ?? 0)),
        endTime: new Date(),
        input: event.input ?? null,
        output: event.output ?? null,
        usage: buildUsage(event),
        ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
      })
    } catch (err) {
      console.error('[observability] Failed to record trace:', err)
    }
    return Promise.resolve()
  }

  async flush(): Promise<void> {
    if (this.flushed) return
    this.flushed = true
    try {
      await this.client.shutdownAsync()
    } catch (err) {
      console.error('[observability] Failed to flush traces:', err)
    }
  }
}

function buildUsage(event: TraceEvent): Record<string, number> {
  const usage: Record<string, number> = {}
  if (event.inputTokens !== undefined) usage['input'] = event.inputTokens
  if (event.outputTokens !== undefined) usage['output'] = event.outputTokens
  if (event.costUsd !== undefined) usage['totalCost'] = event.costUsd
  return usage
}
