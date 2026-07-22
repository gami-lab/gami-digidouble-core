import { describe, expect, it, vi } from 'vitest'
import type {
  ILlmAdapter,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
} from '../../application/ports/ILlmAdapter.js'
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

// The observable stream tests intentionally live with the completion tests to protect the shared trace boundary.
// eslint-disable-next-line max-lines-per-function
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

  it('traces a stream once at terminal completion, not once per delta', async () => {
    const inner = createInnerAdapter({
      stream: async function* (): AsyncIterable<LlmStreamEvent> {
        await Promise.resolve()
        yield { type: 'delta', text: 'hel' }
        yield { type: 'delta', text: 'lo' }
        yield {
          type: 'completed',
          response: {
            content: 'hello',
            model: 'stream-model',
            inputTokens: 12,
            outputTokens: 4,
            latencyMs: 21,
          },
        }
      },
    })
    const observability = createObservability()
    const adapter = new ObservedLlmAdapter(inner, observability.adapter)
    const events = []

    for await (const event of adapter.stream({
      systemPrompt: 'system',
      messages: [{ role: 'user', content: 'hello' }],
      trace: { requestId: 'stream_req' },
    })) {
      events.push(event)
    }

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(events).toHaveLength(3)
    expect(observability.trace).toHaveBeenCalledTimes(1)
    expect(observability.trace).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'stream_req',
        output: 'hello',
        inputTokens: 12,
        outputTokens: 4,
      }),
    )
  })

  it('falls back to a single chunk when the wrapped adapter only supports complete', async () => {
    const inner = createInnerAdapter()
    const adapter = new ObservedLlmAdapter(inner, createObservability().adapter)
    const events = []

    for await (const event of adapter.stream({
      systemPrompt: 'system',
      messages: [{ role: 'user', content: 'hello' }],
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.type)).toEqual(['delta', 'completed'])
    expect(events[1]).toMatchObject({ type: 'completed', response: { content: 'hello' } })
  })

  it('traces client interruption once with an explicit outcome', async () => {
    const controller = new AbortController()
    const inner = createInnerAdapter({
      stream: async function* (_request: LlmRequest, options): AsyncIterable<LlmStreamEvent> {
        yield { type: 'delta', text: 'partial' }
        if (options?.signal?.aborted === true) {
          throw Object.assign(new Error('request aborted'), { name: 'AbortError' })
        }
        await new Promise<void>((resolve) => {
          options?.signal?.addEventListener(
            'abort',
            () => {
              resolve()
            },
            { once: true },
          )
        })
        throw Object.assign(new Error('request aborted'), { name: 'AbortError' })
      },
    })
    const observability = createObservability()
    const adapter = new ObservedLlmAdapter(inner, observability.adapter)
    const events: LlmStreamEvent[] = []

    await expect(
      (async () => {
        for await (const event of adapter.stream(
          {
            systemPrompt: 'system',
            messages: [{ role: 'user', content: 'hello' }],
            trace: { requestId: 'interrupted_req' },
          },
          { signal: controller.signal },
        )) {
          events.push(event)
          controller.abort()
        }
      })(),
    ).rejects.toThrow('request aborted')

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(events).toEqual([{ type: 'delta', text: 'partial' }])
    expect(observability.trace).toHaveBeenCalledTimes(1)
    expect(observability.trace).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'interrupted_req',
        metadata: {
          outcome: 'interrupted',
          interruptionReason: 'client_aborted',
        },
      }),
    )
  })

  it('classifies provider aborts separately from client cancellation', async () => {
    const inner = createInnerAdapter({
      // eslint-disable-next-line @typescript-eslint/require-await, require-yield
      stream: async function* (): AsyncIterable<LlmStreamEvent> {
        throw Object.assign(new Error('provider aborted'), { name: 'AbortError' })
      },
    })
    const observability = createObservability()
    const adapter = new ObservedLlmAdapter(inner, observability.adapter)

    await expect(async () => {
      for await (const event of adapter.stream({
        systemPrompt: 'system',
        messages: [{ role: 'user', content: 'hello' }],
        trace: { requestId: 'provider_interrupted_req' },
      })) {
        expect(event).toBeDefined()
      }
    }).rejects.toThrow('provider aborted')

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(observability.trace).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'provider_interrupted_req',
        metadata: {
          outcome: 'interrupted',
          interruptionReason: 'provider_aborted',
        },
      }),
    )
  })
})
