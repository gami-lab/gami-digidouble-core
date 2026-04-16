import { describe, expect, it } from 'vitest'
import { NullObservabilityAdapter } from './null.adapter.js'
import type { TraceEvent } from '../../application/ports/IObservabilityAdapter.js'

const event: TraceEvent = {
  requestId: 'req-001',
  sessionId: 'session-123',
  event: 'llm.completion',
  latencyMs: 120,
  inputTokens: 15,
  outputTokens: 30,
  costUsd: 0.0001,
  metadata: { model: 'gpt-4o-mini' },
}

describe('NullObservabilityAdapter', () => {
  it('trace() resolves without throwing', async () => {
    const adapter = new NullObservabilityAdapter()
    await expect(adapter.trace(event)).resolves.toBeUndefined()
  })

  it('flush() resolves without throwing', async () => {
    const adapter = new NullObservabilityAdapter()
    await expect(adapter.flush()).resolves.toBeUndefined()
  })

  it('flush() is safe to call multiple times', async () => {
    const adapter = new NullObservabilityAdapter()
    await adapter.flush()
    await expect(adapter.flush()).resolves.toBeUndefined()
  })
})
