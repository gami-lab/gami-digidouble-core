/**
 * Consumer-contract tests for the Langfuse adapter.
 *
 * The consumer here is the Langfuse dashboard. Every field that must appear
 * in the UI must have an assertion in this file — not just the fields the
 * implementation happened to set. When adding a feature to the adapter, start
 * by asking: "what must the Langfuse consumer observe for this to work?"
 * and add assertions for that before writing the production code.
 *
 * The real Langfuse span processor runs; only its OTLP exporter is replaced so
 * the exported OpenTelemetry spans can be asserted.
 */
import { createTraceId } from '@langfuse/tracing'
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LangfuseObservabilityAdapter } from './langfuse.adapter.js'
import type { TraceEvent } from '../../application/ports/IObservabilityAdapter.js'
import { expectConsoleError } from '../../test-utils/console.js'

const exported: ReadableSpan[] = []
const exporterShutdown = vi.fn<() => Promise<void>>()
const exporter: SpanExporter = {
  export: (spans, done) => {
    exported.push(...spans)
    done({ code: 0 })
  },
  shutdown: () => exporterShutdown(),
}

vi.mock('@langfuse/otel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@langfuse/otel')>()
  return {
    ...actual,
    LangfuseSpanProcessor: vi.fn(
      (params: ConstructorParameters<typeof actual.LangfuseSpanProcessor>[0]) =>
        new actual.LangfuseSpanProcessor({ ...params, exporter }),
    ),
  }
})

const event: TraceEvent = {
  requestId: 'req-003',
  sessionId: 'session-789',
  event: 'llm.completion',
  input: [{ role: 'user', content: 'Hello' }],
  output: 'Hello from the model.',
  latencyMs: 150,
  inputTokens: 20,
  outputTokens: 40,
  costUsd: 0.0002,
  metadata: { model: 'gpt-5.6-luna' },
}

function makeAdapter(): LangfuseObservabilityAdapter {
  return new LangfuseObservabilityAdapter('pk-test', 'sk-test', 'http://localhost:3030')
}

async function traceAndExport(traceEvent: TraceEvent): Promise<ReadableSpan> {
  const adapter = makeAdapter()
  await adapter.trace(traceEvent)
  await adapter.flush()
  expect(exported).toHaveLength(1)
  return exported[0] as ReadableSpan
}

function jsonAttribute(span: ReadableSpan, key: string): unknown {
  const value = span.attributes[key]
  expect(typeof value).toBe('string')
  return JSON.parse(value as string)
}

describe('LangfuseObservabilityAdapter', () => {
  beforeEach(() => {
    exported.length = 0
    exporterShutdown.mockReset()
    exporterShutdown.mockResolvedValue(undefined)
  })

  it('exports a generation on the trace id derived from requestId', async () => {
    const span = await traceAndExport(event)

    expect(span.name).toBe(event.event)
    expect(span.spanContext().traceId).toBe(await createTraceId(event.requestId))
    expect(span.attributes['langfuse.observation.type']).toBe('generation')
    expect(span.attributes['langfuse.internal.is_app_root']).toBe(true)
  })

  it('propagates trace name, session id, and requestId onto the observation', async () => {
    const span = await traceAndExport(event)

    expect(span.attributes['langfuse.trace.name']).toBe(event.event)
    expect(span.attributes['session.id']).toBe(event.sessionId)
    expect(jsonAttribute(span, 'langfuse.trace.metadata.requestId')).toBe(event.requestId)
  })

  it('records input, output, model, usage, cost, metadata, and latency', async () => {
    const span = await traceAndExport(event)

    expect(jsonAttribute(span, 'langfuse.observation.input')).toEqual(event.input)
    expect(span.attributes['langfuse.observation.output']).toBe(event.output)
    expect(span.attributes['langfuse.observation.model.name']).toBe('gpt-5.6-luna')
    expect(jsonAttribute(span, 'langfuse.observation.usage_details')).toEqual({
      input: event.inputTokens,
      output: event.outputTokens,
    })
    expect(jsonAttribute(span, 'langfuse.observation.cost_details')).toEqual({
      total: event.costUsd,
    })
    expect(jsonAttribute(span, 'langfuse.observation.metadata.model')).toBe('gpt-5.6-luna')
    const [seconds, nanos] = span.duration
    expect(seconds * 1000 + nanos / 1e6).toBeCloseTo(event.latencyMs ?? 0, 0)
  })

  it('handles a TraceEvent without optional fields', async () => {
    const span = await traceAndExport({ requestId: 'req-min', event: 'ping' })

    expect(span.attributes['session.id']).toBeUndefined()
    expect(span.attributes['langfuse.observation.model.name']).toBeUndefined()
    expect(span.attributes['langfuse.observation.cost_details']).toBeUndefined()
    expect(jsonAttribute(span, 'langfuse.observation.usage_details')).toEqual({})
  })

  it('does not propagate errors from trace()', async () => {
    const adapter = makeAdapter()
    await expectConsoleError(
      () =>
        adapter.trace({
          ...event,
          metadata: {
            get model(): string {
              throw new Error('Langfuse SDK failure')
            },
          },
        }),
      /Failed to record trace.*Langfuse SDK failure/,
    )
  })

  it('flush() exports buffered spans and is idempotent', async () => {
    const adapter = makeAdapter()
    await adapter.trace(event)
    expect(exported).toHaveLength(0)

    await adapter.flush()
    await adapter.flush()
    expect(exported).toHaveLength(1)
    expect(exporterShutdown).toHaveBeenCalledOnce()
  })

  it('does not propagate errors from flush()', async () => {
    exporterShutdown.mockRejectedValue(new Error('shutdown failure'))
    const adapter = makeAdapter()
    await expectConsoleError(() => adapter.flush(), /Failed to flush traces.*shutdown failure/)
  })
})
