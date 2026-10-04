import { describe, expect, it } from 'vitest'
import { validateScenarioModelSelection } from './model-selection-validation.js'

describe('validateScenarioModelSelection', () => {
  it('accepts a modelSelection containing only avatarOverride or memoryOverride', () => {
    expect(
      validateScenarioModelSelection({
        avatarOverride: { provider: 'mistral', model: 'mistral-small-4' },
      }),
    ).toBeNull()
    expect(
      validateScenarioModelSelection({
        memoryOverride: { provider: 'xai', model: 'grok-4.3' },
      }),
    ).toBeNull()
  })

  it('validates catalog models for avatarOverride and memoryOverride', () => {
    expect(
      validateScenarioModelSelection({
        avatarOverride: { provider: 'openai', model: 'unknown-model' },
      }),
    ).toBe(
      'modelSelection.avatarOverride.model must be one of the allowed catalog models for the selected provider',
    )
    expect(
      validateScenarioModelSelection({
        memoryOverride: { provider: 'xai', model: 'unknown-model' },
      }),
    ).toBe(
      'modelSelection.memoryOverride.model must be one of the allowed catalog models for the selected provider',
    )
  })

  it('rejects an empty modelSelection with all four profiles absent', () => {
    expect(validateScenarioModelSelection({})).toBe(
      'modelSelection must define defaultProfile, avatarOverride, gameMasterOverride, or memoryOverride when provided',
    )
  })
})
