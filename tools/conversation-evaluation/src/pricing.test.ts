import { describe, expect, it } from 'vitest'

import { estimateTokenCost } from './pricing.js'

describe('public token pricing estimates', () => {
  it('calculates input and output cost for a known model', () => {
    expect(estimateTokenCost('openai/gpt-5.4', 1_000_000, 2_000_000)).toMatchObject({
      inputPriceUsdPerMillionTokens: 2.5,
      outputPriceUsdPerMillionTokens: 15,
      inputCostUsd: 2.5,
      outputCostUsd: 30,
      totalCostUsd: 32.5,
      pricingAsOf: '2026-07-30',
    })
  })

  it('resolves supported provider aliases', () => {
    expect(estimateTokenCost('xai/grok-4.3-latest', 100, 200)?.model).toBe('xai/grok-4.3')
    expect(estimateTokenCost('anthropic/claude-haiku-4-5-20251001', 100, 200)?.model).toBe(
      'anthropic/claude-haiku-4-5',
    )
  })

  it('returns unavailable for an unknown model', () => {
    expect(estimateTokenCost('provider/unknown-model', 100, 200)).toBeNull()
  })
})
