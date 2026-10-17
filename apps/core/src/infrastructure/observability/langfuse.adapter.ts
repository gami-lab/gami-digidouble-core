import { LangfuseSpanProcessor } from '@langfuse/otel'
import {
  createTraceId,
  propagateAttributes,
  setLangfuseTracerProvider,
  startObservation,
} from '@langfuse/tracing'
import { context, TraceFlags } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base'
import type {
  IObservabilityAdapter,
  TraceEvent,
} from '../../application/ports/IObservabilityAdapter.js'

/**
 * Langfuse-backed observability adapter (JS SDK v6, OpenTelemetry).
 * Records each trace event as a Langfuse generation capturing latency,
 * token counts, cost, and arbitrary metadata.
 *
 * Uses an isolated tracer provider so Langfuse export never depends on, or
 * interferes with, a global OpenTelemetry tracer registration. A context
 * manager is required for propagateAttributes() to reach the observation.
 *
 * Errors from the Langfuse SDK are caught and logged to stderr — observability
 * must never crash or delay the main application flow.
 */
export class LangfuseObservabilityAdapter implements IObservabilityAdapter {
  private readonly provider: BasicTracerProvider
  private flushed = false

  constructor(publicKey: string, secretKey: string, host: string) {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
    this.provider = new BasicTracerProvider({
      spanProcessors: [new LangfuseSpanProcessor({ publicKey, secretKey, baseUrl: host })],
    })
    setLangfuseTracerProvider(this.provider)
  }

  async trace(event: TraceEvent): Promise<void> {
    try {
      const traceId = await createTraceId(event.requestId)
      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - (event.latencyMs ?? 0))
      const model = extractModel(event.metadata)
      propagateAttributes(
        {
          traceName: event.event,
          metadata: { requestId: event.requestId },
          ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
        },
        () => {
          startObservation(
            event.event,
            {
              input: event.input ?? null,
              output: event.output ?? null,
              usageDetails: buildUsageDetails(event),
              ...(event.costUsd !== undefined ? { costDetails: { total: event.costUsd } } : {}),
              ...(model !== undefined ? { model } : {}),
              ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
            },
            {
              asType: 'generation',
              startTime,
              // Langfuse's documented way to pin a custom trace id: a remote parent span context.
              parentSpanContext: {
                traceId,
                spanId: traceId.slice(0, 16),
                traceFlags: TraceFlags.SAMPLED,
                isRemote: true,
              },
            },
          ).end(endTime)
        },
      )
    } catch (err) {
      console.error('[observability] Failed to record trace:', err)
    }
  }

  async flush(): Promise<void> {
    if (this.flushed) return
    this.flushed = true
    try {
      await this.provider.shutdown()
    } catch (err) {
      console.error('[observability] Failed to flush traces:', err)
    }
  }
}

function buildUsageDetails(event: TraceEvent): Record<string, number> {
  const usage: Record<string, number> = {}
  if (event.inputTokens !== undefined) usage['input'] = event.inputTokens
  if (event.outputTokens !== undefined) usage['output'] = event.outputTokens
  return usage
}

function extractModel(metadata: Record<string, unknown> | undefined): string | undefined {
  const model = metadata?.['model']
  return typeof model === 'string' && model.trim().length > 0 ? model : undefined
}
