import { describe, expect, it } from 'vitest'
import {
  EMPTY_MODEL_SELECTION,
  fromAvatarLlmOverride,
  fromScenarioModelSelection,
  hasPartialModelSelection,
  isModelSelectionComplete,
  isModelSelectionEmpty,
  toAvatarLlmOverride,
  toScenarioModelSelection,
} from './model-selection-form'

describe('model selection form helpers', () => {
  it('treats blank/whitespace-only values as empty', () => {
    expect(isModelSelectionEmpty(EMPTY_MODEL_SELECTION)).toBe(true)
    expect(isModelSelectionEmpty({ provider: '  ', model: ' ' })).toBe(true)
    expect(isModelSelectionEmpty({ provider: 'openai', model: '' })).toBe(false)
  })

  it('treats only fully-populated values as complete', () => {
    expect(isModelSelectionComplete({ provider: 'openai', model: 'gpt-4.1-mini' })).toBe(true)
    expect(isModelSelectionComplete({ provider: 'openai', model: '' })).toBe(false)
    expect(isModelSelectionComplete(EMPTY_MODEL_SELECTION)).toBe(false)
  })

  it('flags a partial (one field set, one blank) selection', () => {
    expect(hasPartialModelSelection({ provider: 'openai', model: '' })).toBe(true)
    expect(hasPartialModelSelection({ provider: '', model: 'gpt-4.1-mini' })).toBe(true)
    expect(hasPartialModelSelection(EMPTY_MODEL_SELECTION)).toBe(false)
    expect(hasPartialModelSelection({ provider: 'openai', model: 'gpt-4.1-mini' })).toBe(false)
  })

  it('converts a complete form value to an AvatarLlmOverride, trimming whitespace', () => {
    expect(toAvatarLlmOverride({ provider: ' openai ', model: ' gpt-4.1-mini ' })).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
    })
  })

  it('returns null only when the form value is fully empty', () => {
    expect(toAvatarLlmOverride(EMPTY_MODEL_SELECTION)).toBeNull()
  })

  it('does not null out a partial selection (callers must block submission via hasPartialModelSelection)', () => {
    expect(toAvatarLlmOverride({ provider: 'openai', model: '' })).toEqual({
      provider: 'openai',
      model: '',
    })
  })

  it('round-trips an AvatarLlmOverride through fromAvatarLlmOverride', () => {
    expect(fromAvatarLlmOverride({ provider: 'anthropic', model: 'claude-fable-5' })).toEqual({
      provider: 'anthropic',
      model: 'claude-fable-5',
    })
    expect(fromAvatarLlmOverride(undefined)).toEqual(EMPTY_MODEL_SELECTION)
  })

  it('builds a ScenarioModelSelection with only complete sub-fields included', () => {
    const result = toScenarioModelSelection({
      defaultProfile: { provider: 'openai', model: 'gpt-4.1-mini' },
      gameMasterOverride: { provider: '', model: '' },
    })

    expect(result).toEqual({
      defaultProfile: { provider: 'openai', model: 'gpt-4.1-mini' },
    })
  })

  it('returns undefined when neither profile nor override is complete', () => {
    const result = toScenarioModelSelection({
      defaultProfile: EMPTY_MODEL_SELECTION,
      gameMasterOverride: EMPTY_MODEL_SELECTION,
    })

    expect(result).toBeUndefined()
  })

  it('maps a ScenarioModelSelection back to form values, defaulting missing fields to blank', () => {
    const result = fromScenarioModelSelection({
      defaultProfile: { provider: 'mistral', model: 'mistral-small-latest' },
    })

    expect(result).toEqual({
      defaultProfile: { provider: 'mistral', model: 'mistral-small-latest' },
      gameMasterOverride: EMPTY_MODEL_SELECTION,
    })
  })

  it('maps an undefined ScenarioModelSelection to fully-blank form values', () => {
    expect(fromScenarioModelSelection(undefined)).toEqual({
      defaultProfile: EMPTY_MODEL_SELECTION,
      gameMasterOverride: EMPTY_MODEL_SELECTION,
    })
  })
})
