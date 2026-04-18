/**
 * Consumer-contract tests for the Langfuse adapter.
 *
 * The consumer here is the Langfuse dashboard. Every field that must appear
 * in the UI must have an assertion in this file — not just the fields the
 * implementation happened to set. When adding a feature to the adapter, start
 * by asking: "what must the Langfuse consumer observe for this to work?"
 * and add assertions for that before writing the production code.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LangfuseObservabilityAdapter } from './langfuse.adapter.js'
import type { TraceEvent } from '../../application/ports/IObservabilityAdapter.js'
import { expectConsoleError } from '../../test-utils/console.js'

// ── SDK mock ────────────────────────────────────────────────────────────────

const mockGeneration = vi.fn()
const mockTrace = vi.fn().mockReturnValue({ generation: mockGeneration })
const mockShutdownAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('langfuse', () => {
  const MockLangfuse = vi.fn().mockImplementation(() => ({
    trace: mockTrace,
    shutdownAsync: mockShutdownAsync,
  }))
  return { Langfuse: MockLangfuse }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  metadata: { model: 'gpt-4o' },
}

function makeAdapter(): LangfuseObservabilityAdapter {
  return new LangfuseObservabilityAdapter('pk-test', 'sk-test', 'http://localhost:3030')
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LangfuseObservabilityAdapter', () => {
  beforeEach(() => {
    mockTrace.mockReset()
    mockTrace.mockReturnValue({ generation: mockGeneration })
    mockGeneration.mockReset()
    mockShutdownAsync.mockReset()
    mockShutdownAsync.mockResolvedValue(undefined)
  })

  it('calls langfuse.trace() with requestId and event name', async () => {
    const adapter = makeAdapter()
    await adapter.trace(event)

    expect(mockTrace).toHaveBeenCalledOnce()
    const traceArg = mockTrace.mock.calls[0]?.[0] as Record<string, unknown>
    expect(traceArg['id']).toBe(event.requestId)
    expect(traceArg['name']).toBe(event.event)
    expect(traceArg['sessionId']).toBe(event.sessionId)
  })

  it('calls trace.generation() with usage and metadata', async () => {
    const adapter = makeAdapter()
    await adapter.trace(event)

    expect(mockGeneration).toHaveBeenCalledOnce()
    const genArg = mockGeneration.mock.calls[0]?.[0] as Record<string, unknown>
    const usage = genArg['usage'] as Record<string, number>
    expect(usage['input']).toBe(event.inputTokens)
    expect(usage['output']).toBe(event.outputTokens)
    expect(usage['totalCost']).toBe(event.costUsd)
    expect(genArg['metadata']).toEqual(event.metadata)
    expect(genArg['input']).toEqual(event.input)
    expect(genArg['output']).toBe(event.output)
  })

  it('does not propagate errors from langfuse.trace()', async () => {
    mockTrace.mockImplementation(() => {
      throw new Error('Langfuse network failure')
    })
    const adapter = makeAdapter()
    await expectConsoleError(
      () => adapter.trace(event),
      /Failed to record trace.*Langfuse network failure/,
    )
  })

  it('calls shutdownAsync() on flush()', async () => {
    const adapter = makeAdapter()
    await adapter.flush()
    expect(mockShutdownAsync).toHaveBeenCalledOnce()
  })

  it('flush() is idempotent — only calls shutdownAsync() once', async () => {
    const adapter = makeAdapter()
    await adapter.flush()
    await adapter.flush()
    expect(mockShutdownAsync).toHaveBeenCalledOnce()
  })

  it('does not propagate errors from flush()', async () => {
    mockShutdownAsync.mockRejectedValue(new Error('shutdown failure'))
    const adapter = makeAdapter()
    await expectConsoleError(() => adapter.flush(), /Failed to flush traces.*shutdown failure/)
  })

  it('handles a TraceEvent without optional fields', async () => {
    const minimal: TraceEvent = { requestId: 'req-min', event: 'ping' }
    const adapter = makeAdapter()
    await adapter.trace(minimal)

    expect(mockTrace).toHaveBeenCalledOnce()
    const genArg = mockGeneration.mock.calls[0]?.[0] as Record<string, unknown>
    const usage = genArg['usage'] as Record<string, number>
    expect(Object.keys(usage)).toHaveLength(0)
  })
})
