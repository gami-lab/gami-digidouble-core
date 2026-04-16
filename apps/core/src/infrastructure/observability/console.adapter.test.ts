import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleObservabilityAdapter } from './console.adapter.js'
import type { TraceEvent } from '../../application/ports/IObservabilityAdapter.js'

const event: TraceEvent = {
  requestId: 'req-002',
  sessionId: 'session-456',
  event: 'llm.completion',
  latencyMs: 80,
  inputTokens: 10,
  outputTokens: 25,
  costUsd: 0.00005,
  metadata: { model: 'claude-3-haiku' },
}

describe('ConsoleObservabilityAdapter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('trace() writes JSON to stdout', async () => {
    const adapter = new ConsoleObservabilityAdapter()
    await adapter.trace(event)
    expect(console.log).toHaveBeenCalledOnce()
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(event))
  })

  it('trace() output is valid JSON containing the requestId', async () => {
    const adapter = new ConsoleObservabilityAdapter()
    await adapter.trace(event)
    const logged = vi.mocked(console.log).mock.calls[0]?.[0] as string
    const parsed = JSON.parse(logged) as TraceEvent
    expect(parsed.requestId).toBe(event.requestId)
    expect(parsed.event).toBe(event.event)
  })

  it('flush() resolves immediately without side effects', async () => {
    const adapter = new ConsoleObservabilityAdapter()
    await expect(adapter.flush()).resolves.toBeUndefined()
    expect(console.log).not.toHaveBeenCalled()
  })

  it('flush() is safe to call multiple times', async () => {
    const adapter = new ConsoleObservabilityAdapter()
    await adapter.flush()
    await expect(adapter.flush()).resolves.toBeUndefined()
  })
})
