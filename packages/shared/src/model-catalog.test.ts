import { describe, expect, it } from 'vitest'

import { getModelPresetOptions, isAllowedModelForProvider } from './model-catalog.js'

describe('model catalog', () => {
  it('allows the current OpenAI frontier model selectors', () => {
    for (const model of ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6']) {
      expect(isAllowedModelForProvider('openai', model)).toBe(true)
    }
  })

  it('allows every active Anthropic API model selector', () => {
    for (const model of [
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
    ]) {
      expect(isAllowedModelForProvider('anthropic', model)).toBe(true)
    }
  })

  it('does not expose retired Anthropic models', () => {
    expect(isAllowedModelForProvider('anthropic', 'claude-opus-4-20250514')).toBe(false)
    expect(isAllowedModelForProvider('anthropic', 'claude-3-7-sonnet-20250219')).toBe(false)
    const values = getModelPresetOptions('anthropic', '').map((option) => option.value)
    expect(values).not.toContain('claude-opus-4-20250514')
    expect(values).not.toContain('claude-3-7-sonnet-20250219')
  })
})
