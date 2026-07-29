import { describe, expect, it } from 'vitest'
import { normalizeCostUsd, normalizeMetrics } from './metrics.js'

describe('evaluation metrics normalization', () => {
  it('represents an absent API cost as null', () => {
    expect(normalizeCostUsd(undefined)).toBeNull()
  })

  it('preserves a supplied zero cost as a present value', () => {
    expect(normalizeCostUsd(0)).toBe(0)
  })

  it('derives only total tokens when the API omits that optional field', () => {
    expect(
      normalizeMetrics({
        model: 'test-model',
        latencyMs: 12,
        inputTokens: 4,
        outputTokens: 6,
      }),
    ).toEqual({
      model: 'test-model',
      latencyMs: 12,
      inputTokens: 4,
      outputTokens: 6,
      totalTokens: 10,
      costUsd: null,
    })
  })
})
