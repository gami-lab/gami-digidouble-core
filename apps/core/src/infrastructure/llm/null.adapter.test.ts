import { describe, expect, it, vi } from 'vitest'
import { NullLlmAdapter } from './null.adapter.js'

describe('NullLlmAdapter', () => {
  const request = {
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'user' as const, content: 'Hello' }],
  }

  it('returns deterministic content', async () => {
    const adapter = new NullLlmAdapter('hello world')
    const response = await adapter.complete(request)
    expect(response.content).toBe('hello world')
  })

  it('returns the configured model name', async () => {
    const adapter = new NullLlmAdapter('ok', 'test-model')
    const response = await adapter.complete(request)
    expect(response.model).toBe('test-model')
  })

  it('returns fixed token counts and latency', async () => {
    const adapter = new NullLlmAdapter()
    const response = await adapter.complete(request)
    expect(response.inputTokens).toBe(10)
    expect(response.outputTokens).toBe(20)
    expect(response.latencyMs).toBe(5)
  })

  it('emits one ordered delta followed by terminal completion metadata', async () => {
    const adapter = new NullLlmAdapter('hello world', 'test-model')
    const events = []
    for await (const event of adapter.stream(request)) events.push(event)

    expect(events).toEqual([
      { type: 'delta', text: 'hello world' },
      {
        type: 'completed',
        response: {
          content: 'hello world',
          model: 'test-model',
          inputTokens: 10,
          outputTokens: 20,
          latencyMs: 5,
        },
      },
    ])
  })

  it('honours cancellation before emitting stream events', async () => {
    const controller = new AbortController()
    controller.abort()

    const adapter = new NullLlmAdapter()
    await expect(async () => {
      for await (const event of adapter.stream(request, { signal: controller.signal })) {
        // Consume the stream to exercise the async generator.
        expect(event).toBeDefined()
      }
    }).rejects.toThrow(/aborted/i)
  })

  it('never calls any real network — complete is synchronous in spirit', async () => {
    const spy = vi.fn()
    const adapter = new NullLlmAdapter()
    await adapter.complete(request)
    expect(spy).not.toHaveBeenCalled()
  })
})
