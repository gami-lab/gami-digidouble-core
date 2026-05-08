import { describe, expect, it, vi } from 'vitest'
import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../application/ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import { expectConsoleError } from '../../test-utils/console.js'
import { ObservedLlmAdapter } from './observed.adapter.js'

function createInnerAdapter(overrides: Partial<ILlmAdapter> = {}): ILlmAdapter {
  return {
    complete: vi.fn(
      (_request: LlmRequest): Promise<LlmResponse> =>
        Promise.resolve({
          content: 'hello',
          model: 'test-model',
          inputTokens: 11,
          outputTokens: 7,
          latencyMs: 13,
        }),
    ),
    ...overrides,
  }
}

function createObservability(): {
  adapter: IObservabilityAdapter
  trace: ReturnType<typeof vi.fn>
} {
  const trace = vi.fn().mockResolvedValue(undefined)
  return {
    trace,
    adapter: {
      trace,
      flush: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('ObservedLlmAdapter', () => {
  it('traces successful completions with request context', async () => {
    const inner = createInnerAdapter()
    const observability = createObservability()
    const adapter = new ObservedLlmAdapter(inner, observability.adapter)

    await expect(
      adapter.complete({
        systemPrompt: 'system',
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 50,
        trace: {
          requestId: 'req_1',
          sessionId: 'session_1',
          event: 'memory.maintenance.compaction',
          metadata: { surface: 'memory_maintenance' },
        },
      }),
    ).resolves.toMatchObject({ model: 'test-model', inputTokens: 11, outputTokens: 7 })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(observability.trace).toHaveBeenCalledWith({
      requestId: 'req_1',
      sessionId: 'session_1',
      event: 'memory.maintenance.compaction',
      input: {
        systemPrompt: 'system',
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 50,
      },
      output: 'hello',
      latencyMs: 13,
      inputTokens: 11,
      outputTokens: 7,
      metadata: {
        surface: 'memory_maintenance',
        model: 'test-model',
      },
    })
  })

  it('traces failures with the configured error event and rethrows', async () => {
    const inner = createInnerAdapter({
      complete: vi.fn().mockRejectedValue(new Error('provider down')),
    })
    const observability = createObservability()
    const adapter = new ObservedLlmAdapter(inner, observability.adapter)

    await expect(
      adapter.complete({
        systemPrompt: 'system',
        messages: [{ role: 'user', content: 'hello' }],
        trace: {
          requestId: 'req_2',
          sessionId: 'session_2',
          errorEvent: 'gm.llm_error',
        },
      }),
    ).rejects.toThrow('provider down')

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(observability.trace).toHaveBeenCalledWith({
      requestId: 'req_2',
      sessionId: 'session_2',
      event: 'gm.llm_error',
      input: {
        systemPrompt: 'system',
        messages: [{ role: 'user', content: 'hello' }],
      },
      output: 'provider down',
    })
  })

  it('does not let observability failures break LLM calls', async () => {
    const inner = createInnerAdapter()
    const observability = createObservability()
    observability.trace = vi.fn().mockRejectedValue(new Error('langfuse down'))
    observability.adapter.trace = observability.trace
    const adapter = new ObservedLlmAdapter(inner, observability.adapter)

    const result = await expectConsoleError(
      () =>
        adapter.complete({
          systemPrompt: 'system',
          messages: [{ role: 'user', content: 'hello' }],
        }),
      /Observability trace failed:.*langfuse down/,
    )

    expect(result).toMatchObject({ content: 'hello' })
  })
})
