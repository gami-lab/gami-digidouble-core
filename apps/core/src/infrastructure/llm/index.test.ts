import { describe, expect, it, vi } from 'vitest'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import { createLlmAdapter, NullLlmAdapter, ObservedLlmAdapter } from './index.js'

function createObservabilityAdapter(): IObservabilityAdapter {
  return {
    trace: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
  }
}

describe('createLlmAdapter', () => {
  it('returns the base provider adapter when observability is not provided', () => {
    const adapter = createLlmAdapter({ provider: 'null' })

    expect(adapter).toBeInstanceOf(NullLlmAdapter)
    expect(adapter).not.toBeInstanceOf(ObservedLlmAdapter)
  })

  it('wraps provider adapters with ObservedLlmAdapter when observability is provided', () => {
    const adapter = createLlmAdapter({ provider: 'null' }, createObservabilityAdapter())

    expect(adapter).toBeInstanceOf(ObservedLlmAdapter)
  })

  it('throws for unknown providers', () => {
    expect(() => createLlmAdapter({ provider: 'unknown-provider' })).toThrow(
      'Unknown LLM provider: unknown-provider',
    )
  })
})
