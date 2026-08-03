import { describe, expect, it } from 'vitest'

import { baseDeclaredModel, parseDeclaredModel, parseJudgeModel } from './model-selection.js'

describe('evaluation model selectors', () => {
  it('translates an OpenAI fast Avatar selector into a base model and service tier', () => {
    expect(parseDeclaredModel('openai/gpt-5.6-luna-fast')).toEqual({
      provider: 'openai',
      model: 'gpt-5.6-luna',
      serviceTier: 'fast',
    })
    expect(baseDeclaredModel('openai/gpt-5.6-luna-fast')).toBe('openai/gpt-5.6-luna')
  })

  it('leaves standard and non-OpenAI selectors unchanged', () => {
    expect(parseDeclaredModel('anthropic/claude-sonnet-4-6')).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    })
    expect(parseDeclaredModel('openai/gpt-5.6-luna')).toEqual({
      provider: 'openai',
      model: 'gpt-5.6-luna',
    })
  })

  it('supports the unqualified fast judge selector used with the configured provider', () => {
    expect(parseJudgeModel('gpt-5.4-mini-fast')).toEqual({
      model: 'gpt-5.4-mini',
      serviceTier: 'fast',
    })
    expect(baseDeclaredModel('gpt-5.4-mini-fast')).toBe('gpt-5.4-mini')
  })
})
