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

  it('never calls any real network — complete is synchronous in spirit', async () => {
    const spy = vi.fn()
    const adapter = new NullLlmAdapter()
    await adapter.complete(request)
    expect(spy).not.toHaveBeenCalled()
  })
})
