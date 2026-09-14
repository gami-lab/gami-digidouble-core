import { describe, expect, it } from 'vitest'
import { mapAvatarOverride } from '@gami/shared'
import {
  EMPTY_MODEL_SELECTION,
  fromAvatarLlmOverride,
  fromScenarioModelSelection,
  hasPartialModelSelection,
  isModelSelectionComplete,
  isModelSelectionEmpty,
  toScenarioModelSelection,
} from './model-selection-form'

describe('model selection form helpers', () => {
  it('treats blank/whitespace-only values as empty', () => {
    expect(isModelSelectionEmpty(EMPTY_MODEL_SELECTION)).toBe(true)
    expect(isModelSelectionEmpty({ provider: '  ', model: ' ' })).toBe(true)
    expect(isModelSelectionEmpty({ provider: 'openai', model: '' })).toBe(false)
  })

  it('treats only fully-populated values as complete', () => {
    expect(isModelSelectionComplete({ provider: 'openai', model: 'gpt-5.6-luna' })).toBe(true)
    expect(isModelSelectionComplete({ provider: 'openai', model: '' })).toBe(false)
    expect(isModelSelectionComplete(EMPTY_MODEL_SELECTION)).toBe(false)
  })

  it('flags a partial (one field set, one blank) selection', () => {
    expect(hasPartialModelSelection({ provider: 'openai', model: '' })).toBe(true)
    expect(hasPartialModelSelection({ provider: '', model: 'gpt-5.6-luna' })).toBe(true)
    expect(hasPartialModelSelection(EMPTY_MODEL_SELECTION)).toBe(false)
    expect(hasPartialModelSelection({ provider: 'openai', model: 'gpt-5.6-luna' })).toBe(false)
  })

  it('converts a complete form value to an AvatarLlmOverride, trimming whitespace', () => {
    expect(mapAvatarOverride({ provider: ' openai ', model: ' gpt-5.6-luna ' })).toEqual({
      provider: 'openai',
      model: 'gpt-5.6-luna',
    })
  })

  it('returns null only when the form value is fully empty', () => {
    expect(mapAvatarOverride(EMPTY_MODEL_SELECTION)).toBeNull()
  })

  it('does not null out a partial selection (callers must block submission via hasPartialModelSelection)', () => {
    expect(mapAvatarOverride({ provider: 'openai', model: '' })).toEqual({
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
      defaultProfile: { provider: 'openai', model: 'gpt-5.6-luna' },
      gameMasterOverride: { provider: '', model: '' },
    })

    expect(result).toEqual({
      defaultProfile: { provider: 'openai', model: 'gpt-5.6-luna' },
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
      defaultProfile: { provider: 'mistral', model: 'mistral-small-4' },
    })

    expect(result).toEqual({
      defaultProfile: { provider: 'mistral', model: 'mistral-small-4' },
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
