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
      pricingAsOf: '2026-08-03',
    })
  })

  it('prices the current OpenAI frontier models', () => {
    expect(estimateTokenCost('openai/gpt-5.6-sol', 1_000_000, 1_000_000)).toMatchObject({
      inputPriceUsdPerMillionTokens: 5,
      outputPriceUsdPerMillionTokens: 30,
      totalCostUsd: 35,
    })
    expect(estimateTokenCost('openai/gpt-5.6-terra', 1_000_000, 1_000_000)?.totalCostUsd).toBe(14)
    expect(estimateTokenCost('openai/gpt-5.6-luna', 1_000_000, 1_000_000)?.totalCostUsd).toBe(1.4)
    expect(estimateTokenCost('openai/gpt-5.6', 100, 200)?.model).toBe('openai/gpt-5.6-sol')
  })

  it('prices supported OpenAI Fast mode selectors', () => {
    expect(estimateTokenCost('openai/gpt-5.6-luna-fast', 1_000_000, 1_000_000)).toMatchObject({
      inputPriceUsdPerMillionTokens: 0.4,
      outputPriceUsdPerMillionTokens: 2.4,
      totalCostUsd: 2.8,
      pricingSource: 'https://openai.com/api-fast-mode/',
    })
    expect(estimateTokenCost('openai/gpt-5.4-fast', 1_000_000, 1_000_000)?.totalCostUsd).toBe(35)
  })

  it('prices every active Anthropic model selector', () => {
    const activeModels = [
      'claude-fable-5',
      'claude-opus-5',
      'claude-opus-4-8',
      'claude-opus-4-7',
      'claude-opus-4-6',
      'claude-opus-4-5-20251101',
      'claude-sonnet-5',
      'claude-sonnet-4-6',
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20251001',
    ]

    for (const model of activeModels) {
      expect(estimateTokenCost(`anthropic/${model}`, 100, 200)).not.toBeNull()
    }
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
